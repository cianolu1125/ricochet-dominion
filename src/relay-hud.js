import { chargeFromRelays } from "./charge.js";
const roman = ["0", "Ⅰ", "Ⅱ", "Ⅲ"];
const skills = {
  "zh-CN": ["", "扩张", "切割", "清洗"],
  en: ["", "Expansion", "Crosscut", "Purge"],
};
export class RelayHUD {
  constructor(element) {
    this.element = element;
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
    this.until = time + 1000;
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
    if (ongoing) {
      if (r !== this.relays && !dragging) this.activate(time);
      this.relays = r;
      this.level = chargeFromRelays(r);
      this.endAt = null;
    } else if (this.relays && this.endAt === null) this.endAt = time;
    if (this.endAt !== null && time - this.endAt >= 1200) {
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
    let strength =
      time < this.until
        ? this.activeFrom +
          (1 - this.activeFrom) *
            Math.min(1, Math.max(0, (time - this.activeAt) / 100))
        : Math.max(0, 1 - (time - this.until) / 1000);
    if (this.endAt !== null)
      strength = Math.min(
        strength,
        time - this.endAt < 600
          ? 1
          : Math.max(0, 1 - (time - this.endAt - 600) / 600),
      );
    return strength;
  }
}
