/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync "Large deletions need the owner's confirmation" /
 * "A tab with broken rows is skipped and reported", sync-backups "Backups
 * are listed in Copias de seguridad" — the review cards and the backup list
 * render what the owner must see, and wire the right actions.
 */
import { act, create } from "react-test-renderer";
import { Text } from "react-native";
import { HeldDeletionsCard, SyncProblemsCard } from "../components/SyncReviewCards";
import { BackupList } from "../components/BackupList";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

function texts(tree: ReturnType<typeof create>): string[] {
  return tree.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(""))
    .filter(Boolean);
}

function pressables(tree: ReturnType<typeof create>) {
  return tree.root.findAll((node) => typeof node.props.onPress === "function");
}

function press(tree: ReturnType<typeof create>, label: string) {
  const button = pressables(tree).find((node) =>
    node.findAllByType(Text).some((t) => t.props.children === label)
  );
  act(() => button!.props.onPress());
}

describe("HeldDeletionsCard", () => {
  it("lists what would be deleted and offers Aplicar and Restaurar", () => {
    // Arrange
    const onApply = jest.fn();
    const onRestore = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <HeldDeletionsCard
          counts={{ total: 9, byEntity: { customer: 4, loan: 4, payment: 1, visit: 0 } }}
          onApply={onApply}
          onRestore={onRestore}
        />
      );
    });

    // Act
    press(tree, "Restaurar");
    press(tree, "Aplicar");

    // Assert
    expect(texts(tree)).toEqual(
      expect.arrayContaining(["• 4 clientes", "• 4 préstamos", "• 1 pago"])
    );
    expect(texts(tree).some((t) => t.startsWith("• ") && t.includes("visita"))).toBe(false);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("hides the buttons while busy", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <HeldDeletionsCard
          counts={{ total: 1, byEntity: { customer: 1, loan: 0, payment: 0, visit: 0 } }}
          busy
          onApply={jest.fn()}
          onRestore={jest.fn()}
        />
      );
    });
    expect(texts(tree)).not.toContain("Aplicar");
  });
});

describe("SyncProblemsCard", () => {
  it("names each broken row", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SyncProblemsCard
          problems={[{ entity: "payment", sheetRow: 3, reason: "falta el préstamo" }]}
        />
      );
    });
    expect(texts(tree)).toContain("• Pagos · fila 3: falta el préstamo");
  });
});

describe("BackupList", () => {
  it("shows the empty state", () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<BackupList backups={[]} onSelect={jest.fn()} />);
    });
    expect(texts(tree)).toContain("Aún no hay copias de seguridad");
  });

  it("selects the tapped backup", () => {
    // Arrange
    const onSelect = jest.fn();
    const backup = {
      name: "micobro-backup-1.db",
      createdAt: new Date(2026, 9, 27, 9, 5),
      customers: 2,
      loans: 3,
      payments: 4
    };
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<BackupList backups={[backup]} onSelect={onSelect} />);
    });

    // Act
    act(() => pressables(tree)[0]!.props.onPress());

    // Assert
    expect(onSelect).toHaveBeenCalledWith(backup);
    expect(texts(tree)).toContain("2 clientes · 3 préstamos · 4 pagos");
  });
});
