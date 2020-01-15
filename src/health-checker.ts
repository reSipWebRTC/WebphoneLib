import pTimeout from 'p-timeout';

import { C, Core } from 'sip.js';
import { Utils } from 'sip.js';

import { UserAgent } from 'sip.js/lib/api/user-agent';

export class HealthChecker {
  private optionsTimeout: NodeJS.Timeout;
  private logger: Core.Logger;

  constructor(private userAgent: UserAgent) {
    this.logger = userAgent.userAgentCore.loggerFactory.getLogger('socket-health-checker');
  }

  public stop(): any {
    clearTimeout(this.optionsTimeout);
  }

  /**
   * Start a periodic OPTIONS message to be sent to the sip server, if it
   * does not respond, our connection is probably broken.
   */
  public start(): any {
    return pTimeout(
      new Promise(resolve => {
        clearTimeout(this.optionsTimeout);
        this.userAgent.userAgentCore.request(this.createOptionsMessage(), {
          onAccept: () => {
            resolve();
            this.optionsTimeout = setTimeout(() => {
              this.start();
            }, 22000);
          }
        });
      }),
      5000, // if there is no response after 5 seconds, emit disconnected.
      () => {
        this.logger.error('No response after OPTIONS message to sip server.');
        clearTimeout(this.optionsTimeout);
        this.userAgent.transport.emit('disconnected');
      }
    );
  }

  private createOptionsMessage() {
    const settings = {
      expires: 600,
      extraContactHeaderParams: [],
      instanceId: undefined,
      params: {
        toUri: this.userAgent.configuration.uri,
        toDisplayName: this.userAgent.configuration.displayName,
        callId: Utils.createRandomToken(22),
        cseq: 1,
        fromUri: this.userAgent.userAgentCore.configuration.aor
      },
      regId: undefined,
      registrar: undefined
    };

    /* If no 'registrarServer' is set use the 'uri' value without user portion. */
    if (!settings.registrar) {
      let registrarServer: any = {};
      if (typeof this.userAgent.configuration.uri === 'object') {
        registrarServer = this.userAgent.configuration.uri.clone();
        registrarServer.user = undefined;
      } else {
        registrarServer = this.userAgent.configuration.uri;
      }
      settings.registrar = registrarServer;
    }

    return this.userAgent.userAgentCore.makeOutgoingRequestMessage(
      C.OPTIONS,
      settings.registrar,
      settings.params.fromUri,
      settings.params.toUri ? settings.params.toUri : settings.registrar,
      settings.params
    );
  }
}
