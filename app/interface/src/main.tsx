import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { warnIfContactsUnverified } from "./offline/helpContent";

// Once at startup, while the help numbers are unverified.
warnIfContactsUnverified();

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
