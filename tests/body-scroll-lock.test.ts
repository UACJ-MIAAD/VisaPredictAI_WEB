import {afterEach,describe,it,expect,vi} from "vitest";
import {lockBodyScroll} from "../lib/body-scroll-lock";
afterEach(()=>vi.unstubAllGlobals());
describe("body scroll ownership",()=>{
  for(const order of [[0,1],[1,0]])it(`restores scrolling after nested cleanup ${order}`,()=>{
    const body={style:{overflow:"auto"}};vi.stubGlobal("document",{body});
    const releases=[lockBodyScroll(),lockBodyScroll()];expect(body.style.overflow).toBe("hidden");
    releases[order[0]]();expect(body.style.overflow).toBe("hidden");
    releases[order[1]]();expect(body.style.overflow).toBe("auto");
    const again=lockBodyScroll();again();expect(body.style.overflow).toBe("auto");
  });
  it("releasing twice cannot unlock another owner",()=>{
    const body={style:{overflow:""}};vi.stubGlobal("document",{body});
    const first=lockBodyScroll(),second=lockBodyScroll();first();first();expect(body.style.overflow).toBe("hidden");second();expect(body.style.overflow).toBe("");
  });
  it("preserves a pre-existing external lock",()=>{
    const body={style:{overflow:"hidden"}};vi.stubGlobal("document",{body});
    lockBodyScroll()();expect(body.style.overflow).toBe("hidden");
  });
});
