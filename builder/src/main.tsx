import { createRoot } from "react-dom/client";
import "dialkit/styles.css";
import "./shell/shell.css";
import { App } from "./shell/App";
import { Runtime } from "./core/runtime";
import { installHeadlessApi } from "./shell/headless";

const rt = new Runtime();
installHeadlessApi(rt);
createRoot(document.getElementById("root")!).render(<App rt={rt} />);
