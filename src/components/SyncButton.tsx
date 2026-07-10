import React, { useState, useEffect, useRef } from "react";
import { CloudArrowUp, CloudCheck, WarningCircle } from "@phosphor-icons/react";
import { useTranslation } from "../hooks/useTranslation";
import {
  normalizeData,
  denormalizeData,
  type NormalizedData,
} from "../utils/syncUtils";
import {
  saveAccessToken,
  saveRefreshToken,
  rebuildAccessToken,
  rebuildRefreshToken,
  readDecryptedToken,
  clearTokenCredentials,
} from "../utils/tokenStorage";

const CLIENT_ID = "gvokhca4iidudga";
const REDIRECT_URI = window.location.origin;
const DROPBOX_FILE_PATH = "/Apps/FinanzasPWA/financial_backup.json";

const generateCodeVerifier = () => {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, (dec) => ("0" + dec.toString(16)).substr(-2)).join(
    "",
  );
};

const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const SyncButton: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const authProcessed = useRef(false);

  const startAuthFlow = async () => {
    const verifier = generateCodeVerifier();
    sessionStorage.setItem("pkce_verifier", verifier);
    const challenge = await generateCodeChallenge(verifier);
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${challenge}&code_challenge_method=S256&token_access_type=offline`;
    window.location.href = authUrl;
  };

  /** Procesa el callback OAuth cuando Dropbox redirige de vuelta */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    window.history.replaceState({}, document.title, window.location.pathname);
    if (authProcessed.current) return;
    authProcessed.current = true;

    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
      clearTokenCredentials();
      return;
    }
    if (readDecryptedToken("dropbox_access_token")) return;

    (async () => {
      try {
        const response = await fetch(
          "https://api.dropboxapi.com/oauth2/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              client_id: CLIENT_ID,
              redirect_uri: REDIRECT_URI,
              code_verifier: verifier,
            }),
          },
        );
        const data = await response.json();
        if (data.access_token) {
          // Guardar los 3 fragmentos del token
          await saveAccessToken(data.access_token);
          await saveRefreshToken(data.refresh_token);
          window.location.reload();
        } else {
          console.error("Auth error:", data);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleSync = async () => {
    // Verificar existencia de token (sync, sin reconstruir)
    if (!readDecryptedToken("dropbox_access_token")) {
      startAuthFlow();
      return;
    }

    setStatus("syncing");
    let remoteData: NormalizedData | null = null;

    // Reconstruir token completo desde fragmentos (async)
    let token = await rebuildAccessToken();
    const refreshToken = await rebuildRefreshToken();

    // Intentar refrescar token, si falla usar el actual
    if (refreshToken) {
      try {
        const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: CLIENT_ID,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.access_token) {
            token = data.access_token;
            await saveAccessToken(data.access_token);
          }
        }
        // Si el refresh falla (ej: token aún vigente), seguimos con el actual
      } catch {
        // Error de red, continuar con token actual
      }
    }

    if (!token) {
      clearTokenCredentials();
      startAuthFlow();
      return;
    }

    // Descargar
    try {
      const dlResponse = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_FILE_PATH }),
          },
        },
      );
      if (dlResponse.ok) {
        remoteData = JSON.parse(await dlResponse.text()) as NormalizedData;
      } else if (dlResponse.status === 401) {
        // Token definitivamente inválido → reconectar
        clearTokenCredentials();
        startAuthFlow();
        return;
      }
      // Otros errores (400 = archivo nuevo, 409 = no existe) se ignoran
    } catch {}

    if (remoteData) await denormalizeData(remoteData);

    // Subir
    try {
      const localData = await normalizeData();
      const ulResponse = await fetch(
        "https://content.dropboxapi.com/2/files/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: DROPBOX_FILE_PATH,
              mode: "overwrite",
            }),
            "Content-Type": "application/octet-stream",
          },
          body: JSON.stringify(localData),
        },
      );
      if (!ulResponse.ok) {
        if (ulResponse.status === 401) {
          clearTokenCredentials();
          startAuthFlow();
          return;
        }
        // Error 400 en upload = archivo nuevo listo para crearse, ignoramos
        const errText = await ulResponse.text();
        throw new Error(
          `Upload failed: ${ulResponse.status} ${errText.slice(0, 200)}`,
        );
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (error) {
      console.error("Sync failed:", error);
      setStatus("error");
    }
  };

  return (
    <button
      onClick={handleSync}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        status === "syncing"
          ? "bg-slate-700 text-slate-300 cursor-wait"
          : status === "success"
            ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
            : status === "error"
              ? "bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
              : "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20"
      }`}
    >
      {status === "syncing" && (
        <CloudArrowUp className="animate-bounce" weight="duotone" size={14} />
      )}
      {status === "success" && <CloudCheck weight="duotone" size={14} />}
      {status === "error" && <WarningCircle weight="duotone" size={14} />}
      {status === "idle" && <CloudArrowUp weight="duotone" size={14} />}
      <span>
        {status === "syncing"
          ? t("syncing")
          : readDecryptedToken("dropbox_access_token")
            ? t("sync_now")
            : t("sync_with_dropbox")}
      </span>
    </button>
  );
};

export default SyncButton;
