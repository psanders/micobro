/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #221: a lender takes or picks a real photo for a customer or for
 * themselves. Covers the picker adapter (pickPhoto), the encoder's quality
 * ladder (pickEncoding), the photo field and its sheets, the forms' saving
 * rules, Avatar's photo → cartoon → initials fallback, the display call
 * sites, the unlock screen and the image-picker configuration.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Alert, Image, Linking, Modal, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ValidationError } from "../lib/errors/ValidationError";
import { pickPhoto } from "../lib/photos/pickPhoto";
import { encodePhoto, pickEncoding } from "../lib/photos/encodePhoto";
import { Avatar } from "../components/Avatar";
import { ClientRow } from "../components/ClientRow";
import { PhotoField, type PhotoValue } from "../components/PhotoField";
import { EditCustomerFormScreen } from "../components/screens/EditCustomerFormScreen";
import { NewCustomerFormScreen } from "../components/screens/NewCustomerFormScreen";
import { EditProfileScreen } from "../components/screens/EditProfileScreen";
import { UnlockScreen } from "../components/screens/UnlockScreen";
import appConfig from "../app.config";
import iosEs from "../locales/ios-es.json";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn()
}));

const mockSaveAsync = jest.fn();
const mockResize = jest.fn();
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: (size: unknown) => {
        mockResize(size);
        return { renderAsync: async () => ({ saveAsync: mockSaveAsync }) };
      }
    }))
  }
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}));

const mockCustomerRepo = {
  create: jest.fn(),
  update: jest.fn(),
  getDetail: jest.fn(),
  getPhoto: jest.fn()
};
const mockProfileRepo = { get: jest.fn(), set: jest.fn() };
jest.mock("../lib/repo/RepoProvider", () => ({
  useCustomerRepo: () => mockCustomerRepo,
  useProfileRepo: () => mockProfileRepo
}));
jest.mock("../lib/security/pin", () => ({ verifyPin: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

/** A base64 JPEG ("/9j/" prefix) of exactly `length` characters. */
function jpeg(length: number): string {
  return "/9j/" + "A".repeat(length - 4);
}

const PHOTO = jpeg(8_000);
const OTHER_PHOTO = jpeg(9_000);

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveAsync.mockResolvedValue({ base64: PHOTO });
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function texts(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(""))
    .filter(Boolean);
}

/** The pressable whose own text (or accessibility label) is `label`. */
function findPressable(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) =>
      typeof node.props.onPress === "function" &&
      typeof node.type !== "string" &&
      (node.props.accessibilityLabel === label ||
        node.findAllByType(Text).some((t) => t.props.children === label))
  )[0];
}

async function press(tree: ReactTestRenderer, label: string) {
  const target = findPressable(tree, label);
  if (!target) throw new Error(`No pressable "${label}" in: ${texts(tree).join(" | ")}`);
  await act(async () => {
    await target.props.onPress();
  });
  // An option chosen from a sheet runs once the sheet is gone (iOS can't
  // present the camera over a closing modal): fire every sheet's onDismiss.
  await act(async () => {
    for (const modal of tree.root.findAllByType(Modal)) {
      if (!modal.props.visible) modal.props.onDismiss?.();
    }
  });
  await flush();
}

function visibleTexts(tree: ReactTestRenderer): string[] {
  const hidden = new Set(
    tree.root
      .findAllByType(Modal)
      .filter((m) => !m.props.visible)
      .flatMap((m) => m.findAllByType(Text))
  );
  return tree.root
    .findAllByType(Text)
    .filter((t) => !hidden.has(t))
    .map((node) => [node.props.children].flat().join(""))
    .filter(Boolean);
}

function previewLabel(tree: ReactTestRenderer): string {
  return tree.root.findByProps({ testID: "photo-field-preview" }).props.accessibilityLabel;
}

function avatarSources(tree: ReactTestRenderer) {
  return tree.root.findAllByType(Image).map((img) => img.props.source);
}

function renderField(initial: PhotoValue, name = "Juana Pérez") {
  const onChange = jest.fn();
  const onBusyChange = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <PhotoField
        label="Foto del cliente (opcional)"
        sheetTitle="Foto del cliente"
        name={name}
        value={initial}
        onChange={onChange}
        onBusyChange={onBusyChange}
      />
    );
  });
  return { tree, onChange, onBusyChange };
}

describe("pickPhoto", () => {
  it("asks for the camera, then launches it with a square crop and encodes the result", async () => {
    // Arrange
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true
    } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cam.jpg" }]
    } as never);

    // Act
    const result = await pickPhoto("camera");

    // Assert
    expect(picker.launchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1
    });
    expect(mockResize).toHaveBeenCalledWith({ width: 128, height: 128 });
    expect(result).toEqual({ status: "picked", photo: PHOTO });
  });

  it("opens the gallery the same way without asking for any permission", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);

    // Act
    const result = await pickPhoto("library");

    // Assert
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1
    });
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "picked", photo: PHOTO });
  });

  it("reports a cancel", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    // Act
    const result = await pickPhoto("library");

    // Assert
    expect(result).toEqual({ status: "canceled" });
  });

  it("reports a denied camera without launching it", async () => {
    // Arrange
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false
    } as never);

    // Act
    const result = await pickPhoto("camera");

    // Assert
    expect(result).toEqual({ status: "denied", canAskAgain: false });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });
});

describe("pickEncoding", () => {
  it("returns the first quality at or under 20,000 chars", async () => {
    // Arrange
    const sizes: Record<number, number> = { 0.7: 25_000, 0.55: 20_000, 0.4: 12_000 };
    const encode = jest.fn(async (q: number) => jpeg(sizes[q]!));

    // Act
    const photo = await pickEncoding(encode);

    // Assert
    expect(photo).toHaveLength(20_000);
    expect(encode.mock.calls.map(([q]) => q)).toEqual([0.7, 0.55]);
  });

  it("throws La foto es muy grande when no quality fits", async () => {
    // Arrange
    const encode = jest.fn<Promise<string>, [number]>(async () => jpeg(20_001));

    // Act + Assert
    await expect(pickEncoding(encode)).rejects.toThrow(ValidationError);
    await expect(pickEncoding(encode)).rejects.toThrow("La foto es muy grande");
    expect(encode.mock.calls.map(([q]) => q)).toEqual([0.7, 0.55, 0.4, 0.7, 0.55, 0.4]);
  });

  it("encodePhoto saves a JPEG with base64 at the ladder's qualities", async () => {
    // Arrange
    mockSaveAsync.mockResolvedValueOnce({ base64: jpeg(30_000) });
    mockSaveAsync.mockResolvedValueOnce({ base64: PHOTO });

    // Act
    const photo = await encodePhoto("file:///x.jpg");

    // Assert
    expect(photo).toBe(PHOTO);
    expect(mockSaveAsync).toHaveBeenNthCalledWith(1, {
      format: "jpeg",
      compress: 0.7,
      base64: true
    });
    expect(mockSaveAsync).toHaveBeenNthCalledWith(2, {
      format: "jpeg",
      compress: 0.55,
      base64: true
    });
  });
});

describe("PhotoField", () => {
  it("shows only the preview and Editar, and Editar opens the menu without Quitar when empty", async () => {
    // Arrange
    const { tree } = renderField({ photo: null, avatarKey: null });

    // Assert: closed
    expect(visibleTexts(tree)).toEqual(["Foto del cliente (opcional)", "JP", "Editar"]);
    expect(previewLabel(tree)).toBe("Sin foto");

    // Act
    await act(async () => findPressable(tree, "Editar").props.onPress());

    // Assert: menu
    const shown = visibleTexts(tree);
    expect(shown).toEqual(
      expect.arrayContaining([
        "Foto del cliente",
        "Juana Pérez",
        "Tomar foto",
        "Con la cámara del teléfono",
        "Elegir de la galería",
        "De las fotos del teléfono",
        "Elegir un avatar",
        "Uno de los dibujos de Micobro"
      ])
    );
    expect(shown).not.toContain("Quitar");
  });

  it("offers Quitar when a cartoon or photo is set", async () => {
    // Arrange
    const { tree } = renderField({ photo: null, avatarKey: "male1" });

    // Act
    await act(async () => findPressable(tree, "Editar").props.onPress());

    // Assert
    expect(previewLabel(tree)).toBe("Avatar elegido");
    expect(visibleTexts(tree)).toEqual(
      expect.arrayContaining(["Quitar", "Vuelve a mostrar las iniciales"])
    );
  });

  it("names the subtitle Cliente when the name is empty", async () => {
    // Arrange
    const { tree } = renderField({ photo: null, avatarKey: null }, "");

    // Act
    await act(async () => findPressable(tree, "Editar").props.onPress());

    // Assert
    expect(visibleTexts(tree)).toContain("Cliente");
  });

  it("Elegir un avatar opens the avatar sheet; a cartoon sets it, drops the photo and closes", async () => {
    // Arrange
    const { tree, onChange } = renderField({ photo: PHOTO, avatarKey: null });
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir un avatar");

    // Assert: the avatar sheet
    expect(visibleTexts(tree)).toContain("Elige un avatar");
    const cells = tree.root.findAll(
      (n) => typeof n.type !== "string" && /^Avatar \d$/.test(n.props.accessibilityLabel ?? "")
    );
    expect(new Set(cells.map((c) => c.props.accessibilityLabel)).size).toBe(9);

    // Act
    await press(tree, "Avatar 3");

    // Assert
    expect(onChange).toHaveBeenLastCalledWith({ photo: null, avatarKey: "male1" });
    expect(visibleTexts(tree)).not.toContain("Elige un avatar");
  });

  it("Quitar clears both the photo and the cartoon", async () => {
    // Arrange
    const { tree, onChange } = renderField({ photo: PHOTO, avatarKey: "male2" });
    await press(tree, "Editar");

    // Act
    await press(tree, "Quitar");

    // Assert
    expect(onChange).toHaveBeenLastCalledWith({ photo: null, avatarKey: null });
  });

  it("Tomar foto puts the cropped, encoded photo in the value and keeps the cartoon key", async () => {
    // Arrange
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true
    } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cam.jpg" }]
    } as never);
    const { tree, onChange } = renderField({ photo: null, avatarKey: "male2" });
    await press(tree, "Editar");

    // Act
    await press(tree, "Tomar foto");

    // Assert
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] })
    );
    expect(onChange).toHaveBeenLastCalledWith({ photo: PHOTO, avatarKey: "male2" });
  });

  it("Elegir de la galería opens the system picker with no permission request", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    const { tree, onChange } = renderField({ photo: null, avatarKey: null });
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir de la galería");

    // Assert
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] })
    );
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith({ photo: PHOTO, avatarKey: null });
  });

  it("a cancel leaves the form unchanged with no message", async () => {
    // Arrange
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    const { tree, onChange } = renderField({ photo: null, avatarKey: "male1" });
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir de la galería");

    // Assert
    expect(onChange).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(previewLabel(tree)).toBe("Avatar elegido");
  });

  it("a denied camera shows Sin acceso a la cámara, Abrir Ajustes opens settings, and the gallery and avatars still work", async () => {
    // Arrange
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    picker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false
    } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    const { tree, onChange } = renderField({ photo: null, avatarKey: null });
    await press(tree, "Editar");

    // Act
    await press(tree, "Tomar foto");

    // Assert: the dialog
    expect(alert).toHaveBeenCalledWith(
      "Sin acceso a la cámara",
      "Para tomar la foto, permite la cámara en Ajustes. También puedes elegir una foto de la galería.",
      [
        expect.objectContaining({ text: "Ahora no" }),
        expect.objectContaining({ text: "Abrir Ajustes" })
      ]
    );
    const buttons = alert.mock.calls[0]![2]!;
    buttons[1]!.onPress!();
    expect(openSettings).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    // Act: the gallery still works
    await press(tree, "Editar");
    await press(tree, "Elegir de la galería");
    expect(onChange).toHaveBeenLastCalledWith({ photo: PHOTO, avatarKey: null });

    // Act: avatars still work
    await press(tree, "Editar");
    await press(tree, "Elegir un avatar");
    await press(tree, "Avatar 1");
    expect(onChange).toHaveBeenLastCalledWith({ photo: null, avatarKey: "female1" });
  });

  it("a photo that can't be encoded shows No se pudo usar esta foto and keeps the previous choice", async () => {
    // Arrange
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockSaveAsync.mockResolvedValue({ base64: jpeg(40_000) });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///huge.jpg" }]
    } as never);
    const { tree, onChange } = renderField({ photo: OTHER_PHOTO, avatarKey: null });
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir de la galería");

    // Assert
    expect(alert).toHaveBeenCalledWith(
      "No se pudo usar esta foto",
      "Prueba con otra foto o tómala de nuevo.",
      [expect.objectContaining({ text: "Entendido" })]
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(previewLabel(tree)).toBe("Foto elegida");
  });

  it("shows Preparando foto... and reports busy while the photo is being prepared", async () => {
    // Arrange
    let finish!: (value: unknown) => void;
    mockSaveAsync.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    const { tree, onBusyChange } = renderField({ photo: null, avatarKey: null });
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir de la galería");

    // Assert: busy
    expect(visibleTexts(tree)).toContain("Preparando foto...");
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    // Act: finish
    await act(async () => finish({ base64: PHOTO }));
    await flush();

    // Assert: done
    expect(visibleTexts(tree)).not.toContain("Preparando foto...");
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });
});

describe("customer forms save the photo", () => {
  const detail = {
    id: "c1",
    name: "Juana Pérez",
    phone: "8092512222",
    address: null,
    cedula: null,
    avatarKey: null,
    photo: PHOTO
  };

  async function renderEdit() {
    mockCustomerRepo.getDetail.mockResolvedValue(detail);
    mockCustomerRepo.getPhoto.mockResolvedValue(PHOTO);
    mockCustomerRepo.update.mockResolvedValue({});
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<EditCustomerFormScreen customerId="c1" />);
    });
    await flush();
    return tree;
  }

  it("Editar cliente reads the saved photo and omits photo when untouched", async () => {
    // Arrange
    const tree = await renderEdit();

    // Assert: prefilled
    expect(mockCustomerRepo.getPhoto).toHaveBeenCalledWith("c1");
    expect(previewLabel(tree)).toBe("Foto elegida");

    // Act
    await press(tree, "Guardar cambios");

    // Assert
    const input = mockCustomerRepo.update.mock.calls[0]![1];
    expect(input).not.toHaveProperty("photo");
  });

  it("a photo then a cartoon saves the cartoon's avatarKey and photo: null", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    mockSaveAsync.mockResolvedValue({ base64: OTHER_PHOTO });
    const tree = await renderEdit();
    await press(tree, "Editar");
    await press(tree, "Elegir de la galería");
    await press(tree, "Editar");
    await press(tree, "Elegir un avatar");
    await press(tree, "Avatar 4");

    // Act
    await press(tree, "Guardar cambios");

    // Assert
    expect(mockCustomerRepo.update).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ avatarKey: "male2", photo: null })
    );
  });

  it("Quitar saves no cartoon and photo: null", async () => {
    // Arrange
    const tree = await renderEdit();
    await press(tree, "Editar");
    await press(tree, "Quitar");

    // Assert: initials
    expect(previewLabel(tree)).toBe("Sin foto");

    // Act
    await press(tree, "Guardar cambios");

    // Assert: the domain clears a cartoon with an absent avatarKey
    const input = mockCustomerRepo.update.mock.calls[0]![1];
    expect(input.avatarKey ?? null).toBeNull();
    expect(input.photo).toBeNull();
  });

  it("disables Guardar cambios while the photo is being prepared", async () => {
    // Arrange
    mockSaveAsync.mockReturnValue(new Promise(() => {}));
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    const tree = await renderEdit();
    await press(tree, "Editar");

    // Act
    await press(tree, "Elegir de la galería");

    // Assert
    expect(findPressable(tree, "Guardar cambios").props.disabled).toBe(true);
  });

  it("Nuevo cliente creates the customer with the picked photo", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    mockCustomerRepo.create.mockResolvedValue({});
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<NewCustomerFormScreen />);
    });
    expect(visibleTexts(tree)).toContain("Foto del cliente (opcional)");
    expect(visibleTexts(tree)).not.toContain("Avatar (opcional)");
    await press(tree, "Editar");
    await press(tree, "Elegir de la galería");

    // Act
    await press(tree, "Guardar cliente");

    // Assert
    expect(mockCustomerRepo.create).toHaveBeenCalledWith(expect.objectContaining({ photo: PHOTO }));
  });

  it("Editar perfil labels the field Tu foto and saves the lender's photo", async () => {
    // Arrange
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///lib.jpg" }]
    } as never);
    mockProfileRepo.get.mockResolvedValue({
      name: "Carlos Gómez",
      avatarKey: "male1",
      businessName: null,
      phone: null,
      photo: null
    });
    mockProfileRepo.set.mockResolvedValue({});
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<EditProfileScreen />);
    });
    await flush();
    expect(visibleTexts(tree)).toContain("Tu foto");
    await press(tree, "Editar");
    expect(visibleTexts(tree)).toEqual(expect.arrayContaining(["Tu foto", "Carlos Gómez"]));
    await press(tree, "Elegir de la galería");

    // Act
    await press(tree, "Guardar cambios");

    // Assert
    expect(mockProfileRepo.set).toHaveBeenCalledWith(
      expect.objectContaining({ photo: PHOTO, avatarKey: "male1" })
    );
  });
});

describe("Avatar", () => {
  it("renders the photo as a JPEG data URI", () => {
    // Act
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Avatar photo={PHOTO} avatarKey="male1" name="Juana Pérez" />);
    });

    // Assert
    expect(avatarSources(tree)).toEqual([{ uri: `data:image/jpeg;base64,${PHOTO}` }]);
  });

  it("falls back to the cartoon, then the initials, when there is no photo", () => {
    // Act
    let cartoon!: ReactTestRenderer;
    let initials!: ReactTestRenderer;
    act(() => {
      cartoon = create(<Avatar photo={null} avatarKey="male1" name="Juana Pérez" />);
      initials = create(<Avatar name="Juana Pérez" />);
    });

    // Assert
    expect(avatarSources(cartoon)).toHaveLength(1);
    expect(avatarSources(cartoon)[0]).not.toHaveProperty("uri");
    expect(avatarSources(initials)).toHaveLength(0);
    expect(texts(initials)).toEqual(["JP"]);
  });

  it("falls back when the photo fails to load", () => {
    // Arrange
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Avatar photo={PHOTO} name="Juana Pérez" />);
    });

    // Act
    act(() => tree.root.findByType(Image).props.onError());

    // Assert
    expect(avatarSources(tree)).toHaveLength(0);
    expect(texts(tree)).toEqual(["JP"]);
  });

  it("ClientRow passes the photo through", () => {
    // Act
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<ClientRow photo={PHOTO} name="Juana Pérez" meta="Hoy" />);
    });

    // Assert
    expect(tree.root.findByType(Avatar).props.photo).toBe(PHOTO);
  });
});

describe("display call sites", () => {
  const source = (file: string) =>
    readFileSync(join(__dirname, "../components/screens", file), "utf8");

  it.each([
    ["CustomerDetailScreen.tsx", "photo={customer.photo}"],
    ["HomeScreen.tsx", "photo={visit.photo}"],
    ["HomeScreen.tsx", "photo={customer.photo}"],
    ["RouteScreen.tsx", "photo={visit.photo}"],
    ["SearchScreen.tsx", "photo={customer.photo}"],
    ["CollectPaymentScreen.tsx", "photo={ctx.customerPhoto}"],
    ["VisitOutcomeScreen.tsx", "photo={ctx.customerPhoto}"],
    ["ProfileScreen.tsx", "photo={profile.data.photo}"]
  ])("%s passes %s", (file, prop) => {
    expect(source(file)).toContain(prop);
  });

  it("CollectPaymentScreen passes the photo on both of its avatars", () => {
    expect(source("CollectPaymentScreen.tsx").split("photo={ctx.customerPhoto}")).toHaveLength(3);
  });

  it("the new-loan customer picker keeps cartoons only", () => {
    expect(source("NewLoanFormScreen.tsx")).not.toMatch(/photo=\{/);
  });

  it("Mi cuenta invites the lender to add a name and photo", () => {
    expect(source("ProfileScreen.tsx")).toContain(
      "Agrega tu nombre y foto para personalizar la app."
    );
  });
});

describe("UnlockScreen", () => {
  async function renderUnlock(profile: { avatarKey: string | null; photo: string | null }) {
    mockProfileRepo.get.mockResolvedValue({
      name: "Carlos",
      businessName: null,
      phone: null,
      ...profile
    });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<UnlockScreen onUnlocked={jest.fn()} />);
    });
    await flush();
    return tree;
  }

  it("shows the lender's photo first", async () => {
    const tree = await renderUnlock({ avatarKey: "male1", photo: PHOTO });
    expect(avatarSources(tree)).toContainEqual({ uri: `data:image/jpeg;base64,${PHOTO}` });
  });

  it("shows the cartoon when there is no photo", async () => {
    const tree = await renderUnlock({ avatarKey: "male1", photo: null });
    const sources = avatarSources(tree).filter((s) => s && !("uri" in s));
    expect(sources.length).toBeGreaterThan(0);
    expect(avatarSources(tree)).not.toContainEqual(
      expect.objectContaining({ uri: expect.stringContaining("data:image/jpeg") })
    );
  });

  it("shows no avatar with neither", async () => {
    const withCartoon = await renderUnlock({ avatarKey: "male1", photo: null });
    const neither = await renderUnlock({ avatarKey: null, photo: null });
    expect(avatarSources(neither).length).toBe(avatarSources(withCartoon).length - 1);
    expect(texts(neither)).not.toContain("C");
  });
});

describe("image-picker configuration", () => {
  const MIC = "Micobro necesita el micrófono para grabar feedback dentro de la app.";
  const CAMERA = "Micobro necesita la cámara para tomar la foto de tus clientes y la tuya.";
  const PHOTOS =
    "Micobro necesita acceso a tus fotos para elegir la foto de tus clientes y la tuya.";

  it("carries the Spanish strings and keeps the microphone text", () => {
    // Act
    const config = appConfig({ config: {} } as never);
    const entry = config.plugins!.find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === "expo-image-picker"
    );

    // Assert
    expect(entry?.[1]).toEqual({
      cameraPermission: CAMERA,
      photosPermission: PHOTOS,
      microphonePermission: MIC
    });
    expect(config.ios!.infoPlist!.NSMicrophoneUsageDescription).toBe(MIC);
  });

  it("localizes both keys under ios in locales/ios-es.json", () => {
    expect(iosEs.ios).toEqual(
      expect.objectContaining({
        NSCameraUsageDescription: CAMERA,
        NSPhotoLibraryUsageDescription: PHOTOS,
        NSMicrophoneUsageDescription: MIC
      })
    );
  });
});
