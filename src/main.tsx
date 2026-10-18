
  import { createRoot } from "react-dom/client";
  import { siteContent } from "./config/siteContent";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  document.title = siteContent.name;

  createRoot(document.getElementById("root")!).render(<App />);
  