/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Keeps FakeFineract honest. Every probe runs on the fake and its result is
 * compared to the observation recorded from a real Fineract server
 * (`backoffice/fineract/observed.json`). With FINERACT_LIVE=1 the probes
 * also run on the server from `backoffice/fineract/compose.yaml`, which is
 * how observed.json is refreshed (`npm run backoffice:live`).
 *
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { FakeFineract } from "../fineract/fakeFineract";
import { HttpFineract } from "../fineract/httpFineract";
import { probes } from "../fineract/calibration";

const OBSERVED = path.join(__dirname, "../fineract/observed.json");
const live = process.env.FINERACT_LIVE === "1";
const observed: Record<string, unknown> = fs.existsSync(OBSERVED)
  ? JSON.parse(fs.readFileSync(OBSERVED, "utf8"))
  : {};

function runOnFake(probe: (typeof probes)[string]) {
  const fake = new FakeFineract();
  return probe({
    port: fake,
    setBusinessDate: (date) => fake.setBusinessDate(date)
  });
}

describe("FakeFineract matches what a real Fineract server does", () => {
  const recorded: Record<string, unknown> = {};

  if (live) {
    const http = new HttpFineract({
      baseUrl: process.env.FINERACT_URL ?? "http://localhost:8088/fineract-provider/api/v1",
      tenantId: process.env.FINERACT_TENANT ?? "default",
      username: "mifos",
      password: "password"
    });
    beforeAll(() => http.configureTenant(), 60_000);
    afterAll(async () => {
      const _server = await http.serverBuild();
      fs.writeFileSync(
        OBSERVED,
        `${JSON.stringify({ ...observed, ...recorded, _server }, null, 2)}\n`
      );
    });

    for (const [name, probe] of Object.entries(probes)) {
      it(`live: ${name}`, async () => {
        recorded[name] = await probe({
          port: http,
          setBusinessDate: (d) => http.setBusinessDate(d)
        });
        expect(await runOnFake(probe)).toEqual(recorded[name]);
      }, 120_000);
    }
  } else {
    for (const [name, probe] of Object.entries(probes)) {
      const expected = observed[name];
      (expected === undefined ? it.skip : it)(`fake: ${name}`, async () => {
        expect(await runOnFake(probe)).toEqual(expected);
      });
    }
  }
});
