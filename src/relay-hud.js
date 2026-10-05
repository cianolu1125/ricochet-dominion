import { chargeFromRelays } from "./charge.js";
const ENTER_MS = 200, HOLD_MS = 2500, FADE_MS = 800;
const roman = ["0", "Ⅰ", "Ⅱ", "Ⅲ"];
const skills = {
  "zh-CN": ["", "扩张", "切割", "清洗"],
  en: ["", "Expansion", "Crosscut", "Purge"],
};
export class RelayHUD {
  constructor(element) {
    this.element = element;
    this.turnKey = "";
    this.key = "";
    this.owner = 0;
    this.relays = 0;
    this.level = 0;
    this.until = 0;
    this.endAt = null;
    this.activeAt = -Infinity;
    this.activeFrom = 0;
  }
  reset() {
    this.turnKey = "";
    this.key = "";
    this.owner = 0;
    this.relays = 0;
    this.level = 0;
    this.until = 0;
    this.endAt = null;
    this.activeAt = -Infinity;
    this.activeFrom = 0;
    this.element.hidden = true;
  }
  activate(time) {
    this.activeFrom = this.focus(time);
    this.activeAt = time;
    this.until = time + ENTER_MS + HOLD_MS;
  }
  sync(state, time, language, team, visible = true, dragging = false) {
    const owner = state.current,
      n = state.towers.filter((t) => t.owner === owner).length;
    const r = state.visitedRelayTowerIds.size,
      ongoing = state.phase.startsWith("MISSILE");
    if (owner !== this.owner) {
      this.reset();
      this.owner = owner;
    }
    const turnKey = `${owner}:${state.turnIndex}`;
    if (visible && state.phase !== "HANDOFF" && this.turnKey !== turnKey) {
      this.turnKey = turnKey;
      this.activate(time);
    }
    if (ongoing) {
      if (r !== this.relays && !dragging) this.activate(time);
      this.relays = r;
      this.level = chargeFromRelays(r);
      this.endAt = null;
    } else if (this.relays && this.endAt === null) this.endAt = time;
    if (this.endAt !== null && time >= Math.max(this.endAt + 1200, this.until + FADE_MS)) {
      this.relays = 0;
      this.level = 0;
      this.endAt = null;
    }
    this.element.hidden = !visible || !n;
    this.element.style.setProperty("--relay-team", team[owner]);
    const key = [owner, n, this.relays, this.level, language].join(":");
    if (key !== this.key) {
      this.key = key;
      this.element.querySelector("#relay-track").innerHTML = Array.from(
        { length: n },
        (_, i) =>
          `<span class="relay-node ${[0, 2, 4].includes(i) ? "key-node" : ""} ${i < this.relays ? "lit" : ""}" aria-hidden="true"></span>`,
      ).join("");
      this.element.querySelector("#relay-count").textContent =
        `${language === "en" ? "Relay" : "中继"} ${this.relays}/5`;
      this.element.querySelector("#relay-skill").textContent = this.level
        ? `Charge ${roman[this.level]} · ${skills[language][this.level]}`
        : "";
      this.element
        .querySelector("#relay-track")
        .setAttribute(
          "aria-label",
          `${language === "en" ? "Relay" : "中继"} ${this.relays}/5`,
        );
    }
    const strength = this.focus(time);
    this.element.style.setProperty("--relay-focus", Math.max(0, strength));
  }
  focus(time) {
    return time < this.until
      ? this.activeFrom + (1 - this.activeFrom) * Math.min(1, Math.max(0, (time - this.activeAt) / ENTER_MS))
      : Math.max(0, 1 - (time - this.until) / FADE_MS);
  }
}
