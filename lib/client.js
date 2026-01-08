const VError = require('verror');
const tls = require('tls');
const extend = require('./util/extend');
const createProxySocket = require('./util/proxy');

module.exports = function (dependencies) {
  // Used for routine logs such as HTTP status codes, etc.
  const defaultLogger = dependencies.logger;
  // Used for unexpected events that should be rare under normal circumstances,
  // e.g. connection errors.
  const defaultErrorLogger = dependencies.errorLogger || defaultLogger;
  const { config, http2 } = dependencies;

  const {
    HTTP2_HEADER_STATUS,
    HTTP2_HEADER_SCHEME,
    HTTP2_HEADER_METHOD,
    HTTP2_HEADER_AUTHORITY,
    HTTP2_HEADER_PATH,
    HTTP2_METHOD_POST,
    HTTP2_METHOD_GET,
    HTTP2_METHOD_DELETE,
    NGHTTP2_CANCEL,
  } = http2.constants;

  const HTTPMethod = {
    post: HTTP2_METHOD_POST,
    get: HTTP2_METHOD_GET,
    delete: HTTP2_METHOD_DELETE,
  };

  const TIMEOUT_STATUS = '(timeout)';
  const ABORTED_STATUS = '(aborted)';
  const ERROR_STATUS = '(error)';

  function Client(options) {
    this.isDestroyed = false;
    this.config = config(options);
    this.logger = defaultLogger;
    this.errorLogger = defaultErrorLogger;
    this.healthCheckInterval = setInterval(() => {
      if (this.session && !this.session.closed && !this.session.destroyed && !this.isDestroyed) {
        this.session.ping((error, duration) => {
          if (error && this.errorLogger.enabled) {
            this.errorLogger(
              'No Ping response after ' + duration + ' ms with error:' + error.message
            );
          } else if (this.logger.enabled) {
            this.logger('Ping response after ' + duration + ' ms');
          }
        });
      }
    }, this.config.heartBeat).unref();
    this.manageChannelsHealthCheckInterval = setInterval(() => {
      if (
        this.manageChannelsSession &&
        !this.manageChannelsSession.closed &&
        !this.manageChannelsSession.destroyed &&
        !this.isDestroyed
      ) {
        this.manageChannelsSession.ping((error, duration) => {
          if (error && this.errorLogger.enabled) {
            this.errorLogger(
              'ManageChannelsSession No Ping response after ' +
                duration +
                ' ms with error:' +
                error.message
            );
          } else if (this.logger.enabled) {
            this.logger('ManageChannelsSession Ping response after ' + duration + ' ms');
          }
        });
      }
    }, this.config.heartBeat).unref();
  }

  // The respective session should always be passed.
  Client.prototype.destroySession = function (session) {
    if (!session) {
      return;
    }
    if (!session.destroyed) {
      session.destroy();
    }
    session = null;
  };

  // The respective session should always be passed.
  Client.prototype.closeAndDestroySession = async function (session) {
    if (!session) {
      return;
    }
    if (!session.closed) {
      await new Promise(resolve => {
        session.close(() => {
          resolve();
        });
      });
    }
    this.destroySession(session);
  };

  Client.prototype.makePath = function makePath(type, subDirectory) {
    switch (type) {
      case 'channels':
        return `/1/apps/${subDirectory}/channels`;
      case 'allChannels':
        return `/1/apps/${subDirectory}/all-channels`;
      case 'device':
        return `/3/device/${subDirectory}`;
      case 'broadcasts':
        return `/4/broadcasts/apps/${subDirectory}`;
      default:
        return null;
    }
  };

  Client.prototype.subDirectoryLabel = function subDirectoryLabel(type) {
    switch (type) {
      case 'device':
        return 'device';
      case 'channels':
      case 'allChannels':
      case 'broadcasts':
        return 'bundleId';
      default:
        return null;
    }
  };

  Client.prototype.makeSubDirectoryTypeObject = function makeSubDirectoryTypeObject(
    label,
    subDirectory
  ) {
    const subDirectoryObject = {};
    subDirectoryObject[label] = subDirectory;

    return subDirectoryObject;
  };

  Client.prototype.write = async function write(notification, subDirectory, type, method, count) {
    const retryStatusCodes = [408, 429, 500, 502, 503, 504];
    const retryCount = count || 0;
    const subDirectoryLabel = this.subDirectoryLabel(type) ?? type;
    const subDirectoryInformation = this.makeSubDirectoryTypeObject(
      subDirectoryLabel,
      subDirectory
    );
    const path = this.makePath(type, subDirectory);
    if (path == null) {
      const error = {
        ...subDirectoryInformation,
        error: new VError(`could not make a path for ${type} and ${subDirectory}`),
      };
      throw error;
    }

    const httpMethod = HTTPMethod[method];
    if (httpMethod == null) {
      const error = {
        ...subDirectoryInformation,
        error: new VError(`invalid httpMethod "${method}"`),
      };
      throw error;
    }

    if (this.isDestroyed) {
      const error = { ...subDirectoryInformation, error: new VError('client is destroyed') };
      throw error;
    }

    if (path.includes('/1/apps/')) {
      // Connect manageChannelsSession.
      if (
        !this.manageChannelsSession ||
        this.manageChannelsSession.closed ||
        this.manageChannelsSession.destroyed
      ) {
        try {
          await this.manageChannelsConnect();
        } catch (error) {
          if (this.errorLogger.enabled) {
            // Proxy server that returned error doesn't have access to logger.
            this.errorLogger(error.message);
          }
          const updatedError = { ...subDirectoryInformation, error };
          throw updatedError;
        }
      }

      try {
        const sentRequest = await this.request(
          this.manageChannelsSession,
          this.config.manageChannelsAddress,
          notification,
          path,
          httpMethod
        );
        return { ...subDirectoryInformation, ...sentRequest };
      } catch (error) {
        // Determine if this is a retryable request.
        if (
          retryStatusCodes.includes(error.status) ||
          (typeof error.error !== 'undefined' &&
            error.status == 403 &&
            error.error.message === 'ExpiredProviderToken')
        ) {
          try {
            const resentRequest = await this.retryRequest(
              error,
              this.manageChannelsSession,
              this.config.manageChannelsAddress,
              notification,
              path,
              httpMethod,
              retryCount
            );
            return { ...subDirectoryInformation, ...resentRequest };
          } catch (error) {
            if (error.status == 500) {
              await this.closeAndDestroySession(this.manageChannelsSession);
            }
            delete error.retryAfter; // Never propagate retryAfter outside of client.
            const updatedError = { ...subDirectoryInformation, ...error };
            throw updatedError;
          }
        } else {
          delete error.retryAfter; // Never propagate retryAfter outside of client.
          throw { ...subDirectoryInformation, ...error };
        }
      }
    } else {
      // Connect to standard session.
      if (!this.session || this.session.closed || this.session.destroyed) {
        try {
          await this.connect();
        } catch (error) {
          if (this.errorLogger.enabled) {
            // Proxy server that returned error doesn't have access to logger.
            this.errorLogger(error.message);
          }
          delete error.retryAfter; // Never propagate retryAfter outside of client.
          const updatedError = { ...subDirectoryInformation, error };
          throw updatedError;
        }
      }

      try {
        const sentRequest = await this.request(
          this.session,
          this.config.address,
          notification,
          path,
          httpMethod
        );
        return { ...subDirectoryInformation, ...sentRequest };
      } catch (error) {
        // Determine if this is a retryable request.
        if (
          retryStatusCodes.includes(error.status) ||
          (typeof error.error !== 'undefined' &&
            error.status == 403 &&
            error.error.message === 'ExpiredProviderToken')
        ) {
          try {
            const resentRequest = await this.retryRequest(
              error,
              this.session,
              this.config.address,
              notification,
              path,
              httpMethod,
              retryCount
            );
            return { ...subDirectoryInformation, ...resentRequest };
          } catch (error) {
            if (error.status == 500) {
              await this.closeAndDestroySession(this.session);
            }
            delete error.retryAfter; // Never propagate retryAfter outside of client.
            const updatedError = { ...subDirectoryInformation, ...error };
            throw updatedError;
          }
        } else {
          delete error.retryAfter; // Never propagate retryAfter outside of client.
          throw { ...subDirectoryInformation, ...error };
        }
      }
    }
  };

  Client.prototype.retryRequest = async function retryRequest(
    error,
    session,
    address,
    notification,
    path,
    httpMethod,
    count
  ) {
    if (this.isDestroyed || session.closed) {
      const error = { error: new VError('client session is either closed or destroyed') };
      throw error;
    }

    const retryCount = count + 1;

    if (retryCount > this.config.connectionRetryLimit) {
      throw error;
    }

    const delayInSeconds = parseInt(error.retryAfter || 0);
    // Obey servers request to try after a specific time in ms.
    const delayPromise = new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
    await delayPromise;

    try {
      const sentRequest = await this.request(
        session,
        address,
        notification,
        path,
        httpMethod,
        retryCount
      );
      return sentRequest;
    } catch (error) {
      // Recursivelly call self until retryCount is exhausted
      // or error is thrown.
      const sentRequest = await this.retryRequest(
        error,
        session,
        address,
        notification,
        path,
        httpMethod,
        retryCount
      );
      return sentRequest;
    }
  };

  Client.prototype.connect = function connect() {
    if (this.sessionPromise) return this.sessionPromise;

    const proxySocketPromise = this.config.proxy
      ? createProxySocket(this.config.proxy, {
          host: this.config.address,
          port: this.config.port,
        })
      : Promise.resolve();

    this.sessionPromise = proxySocketPromise.then(socket => {
      this.sessionPromise = null;

      if (socket) {
        this.config.createConnection = authority =>
          authority.protocol === 'http:'
            ? socket
            : authority.protocol === 'https:'
            ? tls.connect(+authority.port || 443, authority.hostname, {
                socket,
                servername: authority.hostname,
                ALPNProtocols: ['h2'],
              })
            : null;
      }

      const session = (this.session = http2.connect(
        this._mockOverrideUrl || `https://${this.config.address}`,
        this.config
      ));

      if (this.logger.enabled) {
        this.session.on('connect', () => {
          this.logger('Session connected');
        });
      }

      this.session.on('close', () => {
        if (this.errorLogger.enabled) {
          this.errorLogger('Session closed');
        }
        this.destroySession(session);
      });

      this.session.on('error', error => {
        if (this.errorLogger.enabled) {
          this.errorLogger(`Session error: ${error}`);
        }
        this.closeAndDestroySession(session);
      });

      this.session.on('goaway', (errorCode, lastStreamId, opaqueData) => {
        if (this.errorLogger.enabled) {
          this.errorLogger(
            `GOAWAY received: (errorCode ${errorCode}, lastStreamId: ${lastStreamId}, opaqueData: ${opaqueData})`
          );
        }
        this.closeAndDestroySession(session);
      });

      this.session.on('frameError', (frameType, errorCode, streamId) => {
        // This is a frame error not associate with any request(stream).
        if (this.errorLogger.enabled) {
          this.errorLogger(
            `Frame error: (frameType: ${frameType}, errorCode ${errorCode}, streamId: ${streamId})`
          );
        }
        this.closeAndDestroySession(session);
      });
    });

    return this.sessionPromise;
  };

  Client.prototype.manageChannelsConnect = async function manageChannelsConnect() {
    if (this.manageChannelsSessionPromise) return this.manageChannelsSessionPromise;

    const proxySocketPromise = this.config.manageChannelsProxy
      ? createProxySocket(this.config.manageChannelsProxy, {
          host: this.config.manageChannelsAddress,
          port: this.config.manageChannelsPort,
        })
      : Promise.resolve();

    this.manageChannelsSessionPromise = proxySocketPromise.then(socket => {
      this.manageChannelsSessionPromise = null;

      if (socket) {
        this.config.createConnection = authority =>
          authority.protocol === 'http:'
            ? socket
            : authority.protocol === 'https:'
            ? tls.connect(+authority.port || this.config.manageChannelsPort, authority.hostname, {
                socket,
                servername: authority.hostname,
                ALPNProtocols: ['h2'],
              })
            : null;
      }

      const config = { ...this.config }; // Only need a shallow copy.
      // http2 will use this address and port.
      config.address = config.manageChannelsAddress;
      config.port = config.manageChannelsPort;

      const session = (this.manageChannelsSession = http2.connect(
        this._mockOverrideUrl || `https://${config.address}`,
        config
      ));

      if (this.logger.enabled) {
        this.manageChannelsSession.on('connect', () => {
          this.logger('ManageChannelsSession connected');
        });
      }

      this.manageChannelsSession.on('close', () => {
        if (this.errorLogger.enabled) {
          this.errorLogger('ManageChannelsSession closed');
        }
        this.destroySession(session);
      });

      this.manageChannelsSession.on('socketError', error => {
        if (this.errorLogger.enabled) {
          this.errorLogger(`ManageChannelsSession Socket error: ${error}`);
        }
        this.closeAndDestroySession(session);
      });

      this.manageChannelsSession.on('error', error => {
        if (this.errorLogger.enabled) {
          this.errorLogger(`ManageChannelsSession error: ${error}`);
        }
        this.closeAndDestroySession(session);
      });

      this.manageChannelsSession.on('goaway', (errorCode, lastStreamId, opaqueData) => {
        if (this.errorLogger.enabled) {
          this.errorLogger(
            `ManageChannelsSession GOAWAY received: (errorCode ${errorCode}, lastStreamId: ${lastStreamId}, opaqueData: ${opaqueData})`
          );
        }
        this.closeAndDestroySession(session);
      });

      this.manageChannelsSession.on('frameError', (frameType, errorCode, streamId) => {
        // This is a frame error not associate with any request(stream).
        if (this.errorLogger.enabled) {
          this.errorLogger(
            `ManageChannelsSession Frame error: (frameType: ${frameType}, errorCode ${errorCode}, streamId: ${streamId})`
          );
        }
        this.closeAndDestroySession(session);
      });
    });

    return this.manageChannelsSessionPromise;
  };

  Client.prototype.createHeaderObject = function createHeaderObject(
    uniqueId,
    requestId,
    channelId,
    notificationId
  ) {
    const header = {};
    if (uniqueId) {
      header['apns-unique-id'] = uniqueId;
    }
    if (requestId) {
      header['apns-request-id'] = requestId;
    }
    if (channelId) {
      header['apns-channel-id'] = channelId;
    }
    if (notificationId) {
      header['apns-id'] = notificationId
    }
    return header;
  };

  Client.prototype.request = async function request(
    session,
    address,
    notification,
    path,
    httpMethod
  ) {
    let tokenGeneration = null;
    let status = null;
    let retryAfter = null;
    let uniqueId = null;
    let requestId = null;
    let channelId = null;
    let notificationId = null;
    let responseData = '';

    const headers = extend(
      {
        [HTTP2_HEADER_SCHEME]: 'https',
        [HTTP2_HEADER_METHOD]: httpMethod,
        [HTTP2_HEADER_AUTHORITY]: address,
        [HTTP2_HEADER_PATH]: path,
      },
      notification.headers
    );

    if (this.config.token) {
      if (this.config.token.isExpired(3300)) {
        this.config.token.regenerate(this.config.token.generation);
      }
      headers.authorization = `bearer ${this.config.token.current}`;
      tokenGeneration = this.config.token.generation;
    }

    const request = session.request(headers);

    request.setEncoding('utf8');

    request.on('response', headers => {
      status = headers[HTTP2_HEADER_STATUS];
      retryAfter = headers['Retry-After'];
      uniqueId = headers['apns-unique-id'];
      requestId = headers['apns-request-id'];
      channelId = headers['apns-channel-id'];
      notificationId = headers["apns-id"];
    });

    request.on('data', data => {
      responseData += data;
    });

    if (notification.body !== '{}') {
      request.write(notification.body);
    }

    return new Promise((resolve, reject) => {
      request.on('end', () => {
        try {
          if (this.logger.enabled) {
            this.logger(`Request ended with status ${status} and responseData: ${responseData}`);
          }
          const headerObject = this.createHeaderObject(uniqueId, requestId, channelId, notificationId);

          if (status === 200 || status === 201 || status === 204) {
            const body = responseData !== '' ? JSON.parse(responseData) : {};
            resolve({ ...headerObject, ...body });
            return;
          } else if ([TIMEOUT_STATUS, ABORTED_STATUS, ERROR_STATUS].includes(status)) {
            const error = {
              status,
              retryAfter,
              error: new VError('Timeout, aborted, or other unknown error'),
            };
            reject({ ...headerObject, ...error });
            return;
          } else if (responseData !== '') {
            const response = JSON.parse(responseData);

            if (status === 403 && response.reason === 'ExpiredProviderToken') {
              this.config.token.regenerate(tokenGeneration);
              const error = {
                status,
                retryAfter,
                error: new VError(response.reason),
              };
              reject({ ...headerObject, ...error });
              return;
            } else if (status === 500 && response.reason === 'InternalServerError') {
              const error = {
                status,
                retryAfter,
                error: new VError('Error 500, stream ended unexpectedly'),
              };
              reject({ ...headerObject, ...error });
              return;
            }
            reject({ ...headerObject, status, retryAfter, response });
          } else {
            const error = {
              error: new VError(`stream ended unexpectedly with status ${status} and empty body`),
            };
            reject({ ...headerObject, ...error });
          }
        } catch (e) {
          const error = new VError(e, 'Unexpected error processing APNs response');
          if (this.errorLogger.enabled) {
            this.errorLogger(`Unexpected error processing APNs response: ${e.message}`);
          }
          reject({ error });
        }
      });

      request.setTimeout(this.config.requestTimeout, () => {
        if (this.errorLogger.enabled) {
          this.errorLogger('Request timeout');
        }

        status = TIMEOUT_STATUS;

        request.close(NGHTTP2_CANCEL);

        const error = { error: new VError('apn write timeout') };
        reject(error);
      });

      request.on('aborted', () => {
        if (this.errorLogger.enabled) {
          this.errorLogger('Request aborted');
        }

        status = ABORTED_STATUS;

        const error = { error: new VError('apn write aborted') };
        reject(error);
      });

      request.on('error', error => {
        if (this.errorLogger.enabled) {
          this.errorLogger(`Request error: ${error}`);
        }

        status = ERROR_STATUS;

        if (typeof error === 'string') {
          error = new VError('apn write failed: %s', error);
        } else {
          error = new VError(error, 'apn write failed');
        }

        reject({ error });
      });

      request.on('frameError', (frameType, errorCode, streamId) => {
        const errorMessage = `Request frame error: (frameType: ${frameType}, errorCode ${errorCode}, streamId: ${streamId})`;
        if (this.errorLogger.enabled) {
          this.errorLogger(errorMessage);
        }
        const error = new VError(errorMessage);
        reject({ error });
      });

      request.end();
    });
  };

  Client.prototype.shutdown = async function shutdown(callback) {
    if (this.isDestroyed) {
      if (callback) {
        callback();
      }
      return;
    }
    if (this.errorLogger.enabled) {
      this.errorLogger('Called client.shutdown()');
    }
    this.isDestroyed = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.manageChannelsHealthCheckInterval) {
      clearInterval(this.manageChannelsHealthCheckInterval);
      this.manageChannelsHealthCheckInterval = null;
    }
    await this.closeAndDestroySession(this.session);
    await this.closeAndDestroySession(this.manageChannelsSession);

    if (callback) {
      callback();
    }
  };

  Client.prototype.setLogger = function (newLogger, newErrorLogger = null) {
    if (typeof newLogger !== 'function') {
      throw new Error(`Expected newLogger to be a function, got ${typeof newLogger}`);
    }
    if (newErrorLogger && typeof newErrorLogger !== 'function') {
      throw new Error(
        `Expected newErrorLogger to be a function or null, got ${typeof newErrorLogger}`
      );
    }
    this.logger = newLogger;
    this.errorLogger = newErrorLogger || newLogger;
  };

  return Client;
};
