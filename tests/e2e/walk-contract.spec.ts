// Contract of gotoSettled's page walk (#63). A CI run once spent the whole 60 s
// test budget inside the walk with no diagnosis. These synthetic pages pin the
// behaviour: the walk is bounded and reports why it stopped, instead of
// chasing a moving page height until the test times out; a page whose height
// settles is still walked to the end, its lazy content mounts and the walk
// returns to the top.
import { test, expect, type Page } from "@playwright/test";
import { gotoSettled } from "./helpers";

const FIXTURE = "/__walk-contract__";

async function serve(page: Page, name: string, html: string): Promise<string> {
  await page.route(`**${FIXTURE}/${name}/`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }),
  );
  return `${FIXTURE}/${name}/`;
}

test("a page that never stops growing fails fast with a diagnosis", async ({ page }) => {
  // Every scroll adds more height than one walk step covers: an unbounded walk
  // would never reach the bottom and would only end at the test timeout.
  test.setTimeout(45_000);
  const path = await serve(
    page,
    "grows",
    `<!doctype html><html><body style="margin:0">
       <div id="filler" style="height:3000px"></div>
       <script>
         addEventListener("scroll", () => {
           const f = document.getElementById("filler");
           f.style.height = (f.offsetHeight + 3000) + "px";
         });
       </script>
     </body></html>`,
  );
  const started = Date.now();
  await expect(gotoSettled(page, path)).rejects.toThrow(/kept growing/);
  expect(Date.now() - started).toBeLessThan(30_000);
});

test("a page with a settled height is walked to the end and back to the top", async ({ page }) => {
  // Lazy content mounts only when its sentinel intersects the viewport, so it
  // proves the walk reached the bottom of a page taller than one viewport.
  const path = await serve(
    page,
    "settles",
    `<!doctype html><html><body style="margin:0">
       <div style="height:4000px"></div>
       <div id="sentinel" style="height:10px"></div>
       <script>
         new IntersectionObserver((entries) => {
           if (entries.some((e) => e.isIntersecting)) {
             const lazy = document.createElement("section");
             lazy.id = "lazy";
             lazy.style.height = "600px";
             document.body.appendChild(lazy);
           }
         }).observe(document.getElementById("sentinel"));
       </script>
     </body></html>`,
  );
  await gotoSettled(page, path);
  await expect(page.locator("#lazy")).toHaveCount(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
