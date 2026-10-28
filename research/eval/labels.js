/**
 * Labels for the development set and the gate set, shared by run_eval.js
 * and k5_measure.js.
 *
 * Without a labels file the scripts score against the acceptable entries
 * in resources/eval/retrieval_eval_set.csv, as before. With one (the
 * schema of retrieval_eval_set_labels_*.csv, for example the relabelled
 * file from relabel_check.js), the acceptable entries of every labelled
 * row (expected_class not "none") come from the labels file instead,
 * and partial entries are dropped, because the labels schema has none.
 * The expected behaviour (ANSWER, NOT_REFERRAL, ...) still comes from
 * the eval set.
 */

"use strict";

const splitIds = (value) =>
  (value || "").split(/[;|]/).map((s) => s.trim()).filter(Boolean);

/**
 * Apply a labels file to eval-set rows.
 *
 * @param {object[]} setRows - Rows of retrieval_eval_set.csv.
 * @param {object[]|null} labelRows - Rows of a labels file, or null.
 * @returns {object[]} New rows; the input is not changed.
 */
function applyDevLabels(setRows, labelRows) {
  if (!labelRows) return setRows.map((row) => ({ ...row }));
  const labels = new Map(labelRows.map((row) => [row.id, row]));
  return setRows.map((row) => {
    const label = labels.get(row.id);
    if (!label || label.expected_class === "none") return { ...row };
    return { ...row, acceptable_entry_ids: label.acceptable_entry_ids, partial_entry_ids: "" };
  });
}

/** The ids of the labelled dev questions (expected class not "none"). */
const labelledIds = (labelRows) =>
  labelRows.filter((row) => row.expected_class !== "none").map((row) => row.id);

/**
 * The acceptable entries of a gate-set row: likely_entry, then any
 * "also acceptable: ..." ids that relabel_check.js writes into notes.
 */
function gateAcceptable(row) {
  const also = (row.notes || "").match(/also acceptable: ([^;\s]+(?:;[^;\s]+)*)/);
  return [...splitIds(row.likely_entry), ...(also ? splitIds(also[1]) : [])];
}

module.exports = { applyDevLabels, gateAcceptable, labelledIds, splitIds };
