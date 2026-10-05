import "./style.css";
import { mountMarket } from "./market";
import { mountPool } from "./pool";
import { mountReputation } from "./reputation";
import { explorerAddressUrl, toast } from "./ui";
import { hasStoredPasskey, registerPasskey, signIn, type MeraWallet } from "./wallet";

let wallet: MeraWallet | null = null;
const getWallet = () => wallet;

const walletStatus = document.getElementById("wallet-status") as HTMLElement;
const signInBtn = document.getElementById("wallet-signin") as HTMLButtonElement;
const registerBtn = document.getElementById("wallet-register") as HTMLButtonElement;

function renderWalletStatus() {
  if (wallet) {
    walletStatus.textContent = wallet.address;
    walletStatus.title = "Signed in with a Mera passkey account";
    signInBtn.textContent = "Switch passkey";
  } else {
    walletStatus.textContent = "Not signed in";
    signInBtn.textContent = hasStoredPasskey() ? "Sign in with passkey" : "Sign in with passkey";
  }
}
renderWalletStatus();

signInBtn.addEventListener("click", async () => {
  try {
    wallet = await signIn();
    renderWalletStatus();
    toast(`Signed in as ${wallet.address}`, "success", { href: explorerAddressUrl(wallet.address), label: "view on explorer" });
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), "error");
  }
});

registerBtn.addEventListener("click", async () => {
  try {
    wallet = await registerPasskey();
    renderWalletStatus();
    toast(`Registered and signed in as ${wallet.address}`, "success", { href: explorerAddressUrl(wallet.address), label: "view on explorer" });
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err), "error");
  }
});

// --- theme toggle, persisted ---
const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;
function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("muster.theme", theme);
}
const storedTheme = localStorage.getItem("muster.theme");
if (storedTheme === "dark" || storedTheme === "light") applyTheme(storedTheme);
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

// --- tabs ---
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>(".tab-panel"));
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((p) => p.classList.toggle("active", p.id === `tab-${btn.dataset.tab}`));
  });
});

// --- mount tab contents ---
mountMarket(document.getElementById("tab-market") as HTMLElement, getWallet);
mountPool(document.getElementById("tab-pool") as HTMLElement, getWallet);
mountReputation(document.getElementById("tab-reputation") as HTMLElement);
