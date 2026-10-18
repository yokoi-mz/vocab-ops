import assert from "node:assert/strict";
import { test } from "node:test";
import { decideValidation, selectValidationSources } from "./validation";

test("検証に使う履歴：直近30件から20件、それより前から10件を選ぶ", () => {
  const generations = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, seq: index + 1 }));
  const selected = selectValidationSources(generations, new Set());
  assert.equal(selected.length, 30);
  assert.equal(new Set(selected).size, 30);
  assert.equal(selected.filter((id) => id > 70).length, 20);
  assert.equal(selected.filter((id) => id <= 70).length, 10);
});

test("検証に使う履歴：それより前が足りないときは、直近から多めに選ぶ（合わせて30件）", () => {
  const generations = Array.from({ length: 35 }, (_, index) => ({ id: index + 1, seq: index + 1 }));
  assert.equal(selectValidationSources(generations, new Set()).length, 30);
});

test("増やす：悪化が25%以下なら合格", () => {
  assert.equal(decideValidation("increase", { improved: 5, worsened: 5, same: 10 }).passed, true);
  assert.equal(decideValidation("increase", { improved: 5, worsened: 6, same: 9 }).passed, false);
});

test("変えない：改善が悪化より2件以上多ければ合格", () => {
  assert.equal(decideValidation("keep", { improved: 7, worsened: 5, same: 8 }).passed, true);
  assert.equal(decideValidation("keep", { improved: 6, worsened: 5, same: 9 }).passed, false);
});

test("判定できた組がなければ不合格", () => {
  assert.equal(decideValidation("decrease", { improved: 0, worsened: 0, same: 0 }).passed, false);
});

test("検証に使う履歴：入れ替える語が関係する履歴を、先に全部選ぶ", () => {
  const generations = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, seq: index + 1 }));
  const relevant = new Set([3, 5, 50, 99]);
  const selected = selectValidationSources(generations, relevant);
  assert.equal(selected.length, 30);
  assert.deepEqual(selected.slice(0, 4).sort((a, b) => a - b), [3, 5, 50, 99]);
  assert.equal(new Set(selected).size, 30);
});
