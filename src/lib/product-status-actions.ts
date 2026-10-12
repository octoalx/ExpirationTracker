/**
 * Pure description of the action buttons shown in an expanded phone product row.
 * Kept free of React so the ordering and status-selection rules stay testable.
 */

export type ProductStatusActionKey = "edit" | "defect" | "active" | "archive";

export interface ProductStatusAction {
  readonly key: ProductStatusActionKey;
  readonly label: string;
  readonly selected: boolean;
}

/** Display order required by the owner; labels are the exact Russian UI copy. */
const ACTION_ORDER: readonly ProductStatusActionKey[] = ["edit", "defect", "active", "archive"];

const ACTION_LABELS: Readonly<Record<ProductStatusActionKey, string>> = {
  edit: "Изменить",
  defect: "Брак",
  active: "Активные",
  archive: "Архив",
};

/** Which button is highlighted for a given product status. Unknown statuses select nothing. */
const SELECTED_BY_STATUS: Readonly<Record<string, ProductStatusActionKey>> = {
  ACTIVE: "active",
  DEFECT: "defect",
  ARCHIVED: "archive",
};

function frozenActions(
  actions: ReadonlyArray<ProductStatusAction>,
): readonly ProductStatusAction[] {
  return Object.freeze(actions.map((action) => Object.freeze({ ...action })));
}

/**
 * Returns an immutable list of four actions in the owner-defined order.
 * `selected` is true only for the action matching the current status;
 * `edit` is never selected and unknown statuses select nothing.
 */
export function getProductActions(
  status: string | null | undefined,
): readonly ProductStatusAction[] {
  const selectedKey = status ? SELECTED_BY_STATUS[status] : undefined;
  return frozenActions(
    ACTION_ORDER.map((key) => ({
      key,
      label: ACTION_LABELS[key],
      selected: selectedKey === key,
    })),
  );
}
