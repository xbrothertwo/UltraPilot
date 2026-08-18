import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SelectedFileField } from "../src/components/selected-file-field";

describe("selected file state", () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });

  it("keeps the native input accessible while presenting the selected file clearly", () => {
    act(() => { renderer = create(<SelectedFileField name="activityFiles" title="GPX- oder FIT-Dateien" hint="maximal 20 MB" accept=".gpx,.fit" multiple />); });
    const input = renderer.root.findByType("input");
    expect(input.props).toMatchObject({ name: "activityFiles", type: "file", multiple: true, className: "sr-only" });
    act(() => input.props.onChange({ currentTarget: { files: [{ name: "7_km_Progressiv_Langer_Lauf.gpx", size: 1_468_006, lastModified: 1 }] } }));
    expect(renderer.root.findAll((node) => node.type === "p" && String(node.children.join(" ")).includes("7_km_Progressiv_Langer_Lauf.gpx"))).toHaveLength(1);
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain("GPX");
    expect(rendered).toContain("1,4 MB");
    expect(rendered).toContain("bereit zum Import");
    expect(renderer.root.findByProps({ "aria-label": "7_km_Progressiv_Langer_Lauf.gpx entfernen" })).toBeTruthy();
  });
});
