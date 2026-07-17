/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Bluetooth thermal receipt printer (58mm ESC/POS).
 * Requires react-native-ble-plx and a development build to function.
 */
import { Alert, Platform, PermissionsAndroid } from "react-native";

const LINE_WIDTH = 32;

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  FEED_CUT: [GS, 0x56, 0x41, 0x03],
  FEED_LINES: (n: number) => [ESC, 0x64, n]
} as const;

export interface PrintReceiptLine {
  label: string;
  amountCents: number;
}

export interface PrintReceiptData {
  receiptNumber: string;
  customerName: string;
  date: string;
  method: string;
  lines: PrintReceiptLine[];
  totalCents: number;
}

function text(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function line(s: string): number[] {
  return [...text(s), 0x0a];
}

function pad(label: string, value: string): string {
  const gap = LINE_WIDTH - label.length - value.length;
  return label + " ".repeat(Math.max(1, gap)) + value;
}

function divider(char = "-"): string {
  return char.repeat(LINE_WIDTH);
}

function formatRD(cents: number): string {
  const amount = cents / 100;
  return `RD$${amount.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildReceiptBytes(data: PrintReceiptData): Uint8Array {
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);

  push(...CMD.INIT);
  push(...CMD.CENTER);
  push(...CMD.BOLD_ON);
  push(...CMD.DOUBLE_HEIGHT);
  push(...line("MICOBRO"));
  push(...CMD.NORMAL_SIZE);
  push(...line("RECIBO DE PAGO"));
  push(...CMD.BOLD_OFF);
  push(...line(divider("=")));
  push(...CMD.LEFT);

  push(...line(`Recibo: #${data.receiptNumber}`));
  push(...line(`Cliente: ${data.customerName}`));
  push(...line(`Fecha: ${data.date}`));
  push(...line(""));

  for (const item of data.lines) {
    push(...line(pad(`${item.label}:`, formatRD(item.amountCents))));
  }

  push(...line(divider()));
  push(...CMD.BOLD_ON);
  push(...line(pad("TOTAL:", formatRD(data.totalCents))));
  push(...CMD.BOLD_OFF);

  push(...line(""));
  push(...line(pad("Metodo:", data.method)));

  push(...line(divider("=")));
  push(...CMD.CENTER);
  push(...CMD.BOLD_ON);
  push(...line("Gracias por su pago!"));
  push(...CMD.BOLD_OFF);
  push(...CMD.FEED_LINES(4));
  push(...CMD.FEED_CUT);

  return new Uint8Array(bytes);
}

type BleManager = {
  startDeviceScan: (
    uuids: null,
    opts: null,
    cb: (err: unknown, device: BleDevice | null) => void
  ) => void;
  stopDeviceScan: () => void;
  connectToDevice: (id: string) => Promise<BleDevice>;
  destroy: () => void;
};

type BleDevice = {
  id: string;
  name: string | null;
  localName: string | null;
  discoverAllServicesAndCharacteristics: () => Promise<BleDevice>;
  characteristicsForService: (serviceUUID: string) => Promise<Array<{
    uuid: string;
    isWritableWithResponse: boolean;
    isWritableWithoutResponse: boolean;
  }> | null>;
  services: () => Promise<Array<{ uuid: string }> | null>;
  writeCharacteristicWithResponseForService: (
    svc: string,
    char: string,
    value: string
  ) => Promise<unknown>;
  cancelConnection: () => Promise<void>;
};

let cachedManager: BleManager | null = null;

async function getBleManager(): Promise<BleManager> {
  if (cachedManager) return cachedManager;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require("react-native-ble-plx");
    cachedManager = new BleManager() as BleManager;
    return cachedManager;
  } catch {
    throw new Error(
      "react-native-ble-plx is not installed. A development build is required for Bluetooth printing."
    );
  }
}

const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 20;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function findWritableCharacteristic(device: BleDevice) {
  const services = await device.services();
  if (!services) throw new Error("No services found on device");

  for (const svc of services) {
    const chars = await device.characteristicsForService(svc.uuid);
    if (!chars) continue;
    for (const c of chars) {
      if (c.isWritableWithResponse || c.isWritableWithoutResponse) {
        return { serviceUUID: svc.uuid, characteristicUUID: c.uuid };
      }
    }
  }
  throw new Error("No writable characteristic found");
}

async function writeToDevice(device: BleDevice, data: Uint8Array): Promise<void> {
  let target: { serviceUUID: string; characteristicUUID: string };
  try {
    const chars = await device.characteristicsForService(PRINTER_SERVICE_UUID);
    const writable = chars?.find((c) => c.uuid.toLowerCase().includes("2af1"));
    if (writable) {
      target = { serviceUUID: PRINTER_SERVICE_UUID, characteristicUUID: writable.uuid };
    } else {
      target = await findWritableCharacteristic(device);
    }
  } catch {
    target = await findWritableCharacteristic(device);
  }

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    const b64 = toBase64(chunk);
    await device.writeCharacteristicWithResponseForService(
      target.serviceUUID,
      target.characteristicUUID,
      b64
    );
  }
}

const PRINTER_NAME_KEYWORDS = ["print", "pos", "thermal", "mtp", "rpp", "xp-", "tp-", "bt-p"];

function looksLikePrinter(name: string): boolean {
  const lower = name.toLowerCase();
  return PRINTER_NAME_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function scanForPrinters(timeoutMs = 10000): Promise<{
  matched: Array<{ id: string; name: string }>;
  all: Array<{ id: string; name: string }>;
}> {
  const manager = await getBleManager();
  const matched: Array<{ id: string; name: string }> = [];
  const all: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      resolve({ matched, all });
    }, timeoutMs);

    manager.startDeviceScan(null, null, (err, device) => {
      if (err || !device) return;
      const name = device.localName ?? device.name;
      if (!name || seen.has(device.id)) return;
      seen.add(device.id);
      all.push({ id: device.id, name });
      if (looksLikePrinter(name)) {
        matched.push({ id: device.id, name });
      }
    });

    // timer already handles resolution
    void timer;
  });
}

export async function printReceipt(deviceId: string, data: PrintReceiptData): Promise<void> {
  const manager = await getBleManager();
  const receiptBytes = buildReceiptBytes(data);

  const device = await manager.connectToDevice(deviceId);
  try {
    await device.discoverAllServicesAndCharacteristics();
    await writeToDevice(device, receiptBytes);
  } finally {
    try {
      await device.cancelConnection();
    } catch {
      // ignore disconnect errors
    }
  }
}

export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === "granted" &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === "granted"
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === "granted";
}

function pickDevice(devices: Array<{ id: string; name: string }>, data: PrintReceiptData): void {
  if (devices.length === 0) return;
  if (devices.length === 1) {
    printReceipt(devices[0].id, data).catch((err) => {
      Alert.alert("Error de impresión", err instanceof Error ? err.message : "Error desconocido");
    });
    return;
  }
  const buttons = devices.map((d) => ({
    text: d.name,
    onPress: () =>
      printReceipt(d.id, data).catch((err) => {
        Alert.alert("Error de impresión", err instanceof Error ? err.message : "Error desconocido");
      })
  }));
  buttons.push({ text: "Cancelar", onPress: () => Promise.resolve() });
  Alert.alert("Seleccionar impresora", "Elige un dispositivo:", buttons);
}

export async function printReceiptWithUI(data: PrintReceiptData): Promise<void> {
  try {
    const granted = await requestBluetoothPermission();
    if (!granted) {
      Alert.alert(
        "Permiso denegado",
        "Activa los permisos de Bluetooth en Ajustes para poder imprimir.",
        [{ text: "OK" }]
      );
      return;
    }

    const { matched, all } = await scanForPrinters();

    if (matched.length > 0) {
      pickDevice(matched, data);
      return;
    }

    if (all.length === 0) {
      Alert.alert(
        "No se encontró impresora",
        "Enciende la impresora Bluetooth y asegúrate que esté cerca del teléfono.",
        [{ text: "OK" }]
      );
      return;
    }

    // Found BLE devices but none matched printer keywords — let user pick
    Alert.alert(
      "Seleccionar impresora",
      "No se detectó una impresora automáticamente. ¿Cuál de estos dispositivos es tu impresora?",
      [
        ...all.map((d) => ({
          text: d.name,
          onPress: () =>
            printReceipt(d.id, data).catch((err) => {
              Alert.alert(
                "Error de impresión",
                err instanceof Error ? err.message : "Error desconocido"
              );
            })
        })),
        { text: "Cancelar", onPress: () => {} }
      ]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    Alert.alert("Error de impresión", msg);
  }
}
