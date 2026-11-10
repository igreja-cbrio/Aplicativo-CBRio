import { describe, expect, it } from "vitest";
import { htmlLoginVideo, LOGIN_VIDEO_PLAYING, LOGIN_VIDEO_URL } from "../lib/loginVideo";

describe("htmlLoginVideo", () => {
  const html = htmlLoginVideo();
  it("usa o mp4 do hero, mudo, em loop, inline e cover", () => {
    expect(html).toContain(`src="${LOGIN_VIDEO_URL}"`);
    for (const a of ["muted", "autoplay", "loop", "playsinline"]) expect(html).toContain(a);
    expect(html).toContain("object-fit:cover");
  });
  it("não mostra controles e avisa quando começa a tocar", () => {
    expect(html).not.toContain("controls");
    expect(html).toContain(`post('${LOGIN_VIDEO_PLAYING}')`);
  });
});
