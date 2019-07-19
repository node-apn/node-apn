/// <reference types="node" />

import { EventEmitter } from 'events';

export interface ProviderToken {
  /**
   * The filename of the provider token key (as supplied by Apple) to load from disk, or a Buffer/String containing the key data.
   */
  key: Buffer|string;
  /**
   * The ID of the key issued by Apple
   */
  keyId: string;
  /**
   * ID of the team associated with the provider token key
   */
  teamId: string;
}

export interface ProviderOptions {
  /**
   * Configuration for Provider Authentication Tokens. (Defaults to: null i.e. fallback to Certificates)
   */
  token?: ProviderToken;
  /**
   * The filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data. (Defaults to: `cert.pem`)
   */
  cert?: string|Buffer;
  /**
   * The filename of the connection key to load from disk, or a Buffer/String containing the key data. (Defaults to: `key.pem`)
   */
  key?: string|Buffer;
  /**
   * An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String (in PEM format) to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).
   */
  ca?: (string|Buffer)[];
  /**
   * File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer containing the PFX data. If supplied will always be used instead of certificate and key above.
   */
  pfx?: string|Buffer;
  /**
   * The passphrase for the connection key, if required
   */
  passphrase?: string;
  /**
   * Specifies which environment to connect to: Production (if true) or Sandbox - The hostname will be set automatically. (Defaults to NODE_ENV == "production", i.e. false unless the NODE_ENV environment variable is set accordingly)
   */
  production?: boolean;
  /**
   * Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)
   */
  rejectUnauthorized?: boolean;
  /**
   * The maximum number of connection failures that will be tolerated before `apn` will "terminate". (Defaults to: 3)
   */
  connectionRetryLimit?: number;
}

interface ApsAlert {
  body?: string
  "loc-key"?: string
  "loc-args"?: any[]
  title?: string
  "title-loc-key"?: string
  "title-loc-args"?: any[]
  action?: string
  "action-loc-key"?: string
}

interface Aps {
  alert?: string | ApsAlert
  "launch-image"?: string
  badge?: number
  sound?: string
  "content-available"?: undefined | 1
  "mutable-content"?: undefined | 1
  "url-args"?: string[]
  category?: string
}

export interface ResponseSent {
  device: string;
}
export interface ResponseFailure {
  device: string;
  error?: Error;
  status?: string;
  response?: {
    reason: string;
    timestamp?: string;
  };
}

export interface Responses {
  sent:   ResponseSent[];
  failed: ResponseFailure[];
}

export class Provider extends EventEmitter {
  constructor(options: ProviderOptions);
  /**
   * This is main interface for sending notifications. Create a Notification object and pass it in, along with a single recipient or an array of them and node-apn will take care of the rest, delivering a copy of the notification to each recipient.
   *
   * A "recipient" is a String containing the hex-encoded device token.
   */
  send(notification: Notification, recipients: string|string[]): Promise<Responses>;
  /**
   * Indicate to node-apn that it should close all open connections when the queue of pending notifications is fully drained. This will allow your application to terminate.
   */
  shutdown(): void;
}

export interface NotificationAlertOptions {
  title?: string;
  subtitle?: string;
  body: string;
  "title-loc-key"?: string;
  "title-loc-args"?: string[];
  "action-loc-key"?: string;
  "loc-key"?: string;
  "loc-args"?: string[];
  "launch-image"?: string;
}

export class Notification {
  /**
   * You can optionally pass in an object representing the payload, or configure properties on the returned object.
   */
  constructor(payload?: any);

  /**
   * Required: The destination topic for the notification.
   */
  public topic: string;
  /**
   * A UUID to identify the notification with APNS. If an id is not supplied, APNS will generate one automatically. If an error occurs the response will contain the id. This property populates the apns-id header.
   */
  public id: string;
  /**
   * The UNIX timestamp representing when the notification should expire. This does not contribute to the 2048 byte payload size limit. An expiry of 0 indicates that the notification expires immediately.
   */
  public expiry: number;
  /**
   * Provide one of the following values:
   *
   * - 10 - The push message is sent immediately. (Default)
   *   > The push notification must trigger an alert, sound, or badge on the device. It is an error use this priority for a push that contains only the content-available key.
   * - 5 - The push message is sent at a time that conserves power on the device receiving it.
   */
  public priority: number;

  public collapseId: string;
  public pushType: string;
  public threadId: string;

  /**
   * This Object is JSON encoded and sent as the notification payload. When properties have been set on notification.aps (either directly or with convenience setters) these are added to the payload just before it is sent. If payload already contains an aps property it is replaced.
   */
  public payload: any;
  public aps: Aps;

  /**
   * If supplied this payload will be encoded and transmitted as-is. The convenience setters will have no effect on the JSON output.
   */
  public rawPayload: any;

  /**
   * The value to specify for `payload.aps.badge`
   */
  public badge: number;
  /**
   * The value to specify for `payload.aps.sound`
   */
  public sound: string;
  /**
   * The value to specify for `payload.aps.alert` can be either a `String` or an `Object` as outlined by the payload documentation.
   */
  public alert: string|NotificationAlertOptions;
  /**
   * Setting this to true will specify "content-available" in the payload when it is compiled.
   */
  public contentAvailable: boolean;
  /**
   *
   */
  public mutableContent: boolean;
  /**
   * The value to specify for the `mdm` field where applicable.
   */
  public mdm: string|Object;
  /**
   * The value to specify for `payload.aps['url-args']`. This used for Safari Push NOtifications and should be an array of values in accordance with the Web Payload Documentation.
   */
  public urlArgs: string[];
}

export function token(token: (string | Buffer)) : string
