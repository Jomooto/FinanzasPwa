import React from "react";
import { ShieldCheck } from "@phosphor-icons/react";

export const SecurityDisclaimer: React.FC = () => {
  return (
    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <ShieldCheck weight="duotone" className="text-blue-400" size={20} />
        Seguridad y Responsabilidad
      </h3>
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-sm text-blue-200 leading-relaxed">
          Tus datos están cifrados de extremo a extremo y sincronizados
          únicamente con tu cuenta de Dropbox. No almacenamos tus claves de
          acceso ni tenemos forma de recuperar tus datos si pierdes el acceso a
          tu cuenta de Dropbox.
        </p>
        <p className="text-sm text-blue-200/80 leading-relaxed mt-3">
          Es tu responsabilidad mantener protegida tu cuenta de Dropbox.
          Recomendamos activar la verificación en dos pasos (2FA) para maximizar
          la seguridad de tus datos financieros.
        </p>
      </div>
    </div>
  );
};
