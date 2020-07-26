import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service
} from 'homebridge';
const piblaster = require('pi-blaster.js'); // eslint-disable-line @typescript-eslint/no-var-requires

let hap: HAP;

const PLUGIN_NAME = 'homebridge-gpio-rgbw-ledstrip';
const ACCESSORY_NAME = 'SmartLedStrip';

type RGBW = {
  R: number,
  G: number,
  B: number,
  W: number
};

class SmartLedStrip implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private readonly rPin: number;
  private readonly gPin: number;
  private readonly bPin: number;
  private readonly wPin: number;
  private service?: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) { // eslint-disable-line @typescript-eslint/no-unused-vars
    this.log = log;
    this.name = config['name'];

    this.rPin = config['rPin'];
    this.gPin = config['gPin'];
    this.bPin = config['bPin'];
    this.wPin = config['wPin'];
  }

  getServices(): Array<Service> {
    const accInfo = new hap.Service.AccessoryInformation();

    accInfo
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Sunoo')
      .setCharacteristic(hap.Characteristic.Model, 'RGBW LED Strip')
      .setCharacteristic(hap.Characteristic.SerialNumber, this.rPin + ':' + this.gPin + ':' + this.bPin + ':' + this.wPin);

    const service = new hap.Service.Lightbulb(this.name);

    service
      .getCharacteristic(hap.Characteristic.On)
      .on('change', this.toggleState.bind(this));

    service
      .addCharacteristic(new hap.Characteristic.Brightness())
      .on('change', this.toggleState.bind(this));

    service
      .addCharacteristic(new hap.Characteristic.Hue())
      .on('change', this.toggleState.bind(this));

    service
      .addCharacteristic(new hap.Characteristic.Saturation())
      .on('change', this.toggleState.bind(this));

    service.getCharacteristic(hap.Characteristic.Brightness).value = 100;

    this.service = service;

    return [accInfo, service];
  }

  toggleState(): void {
    if (this.service) {
      if (!this.service.getCharacteristic(hap.Characteristic.On).value) {
        this.updateRGBW(0, 0, 0, 0);
      } else {
        const h = this.service.getCharacteristic(hap.Characteristic.Hue).value as number;
        const s = this.service.getCharacteristic(hap.Characteristic.Saturation).value as number;
        const b = this.service.getCharacteristic(hap.Characteristic.Brightness).value as number;
        const rgbw = this.hsb2rgbw(h, s, b);
        this.updateRGBW(rgbw.R, rgbw.G, rgbw.B, rgbw.W);
      }
    }
  }

  updateRGBW(red: number, green: number, blue: number, white: number): void {
    this.log.debug('Setting RGBW: ' + red + ', ' + green + ', ' + blue + ', ' + white);
    piblaster.setPwm(this.rPin, red / 100);
    piblaster.setPwm(this.gPin, green / 100);
    piblaster.setPwm(this.bPin, blue / 100);
    piblaster.setPwm(this.wPin, white / 100);
  }

  hsb2rgbw(H: number, S: number, B: number): RGBW {
    const rgbw = {
      R: 0,
      G: 0,
      B: 0,
      W: 0
    };

    if (H == 0 && S == 0) {
      rgbw.W = B;
    } else {
      const segment = Math.floor(H / 60);
      const offset = H % 60;
      const mid = B * offset / 60;

      rgbw.W = Math.round(B / 100 * (100 - S));

      if (segment == 0) {
        rgbw.R = Math.round(S / 100 * B);
        rgbw.G = Math.round(S / 100 * mid);
      } else if (segment == 1) {
        rgbw.R = Math.round(S / 100 * (B - mid));
        rgbw.G = Math.round(S / 100 * B);
      } else if (segment == 2) {
        rgbw.G = Math.round(S / 100 * B);
        rgbw.B = Math.round(S / 100 * mid);
      } else if (segment == 3) {
        rgbw.G = Math.round(S / 100 * (B - mid));
        rgbw.B = Math.round(S / 100 * B);
      } else if (segment == 4) {
        rgbw.R = Math.round(S / 100 * mid);
        rgbw.B = Math.round(S / 100 * B);
      } else if (segment == 5) {
        rgbw.R = Math.round(S / 100 * B);
        rgbw.B = Math.round(S / 100 * (B - mid));
      }
    }

    return rgbw;
  }

}

export = (api: API): void => {
  hap = api.hap;

  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, SmartLedStrip);
};
