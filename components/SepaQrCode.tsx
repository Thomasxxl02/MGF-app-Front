import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, Info, ShieldCheck, ArrowRight, Smartphone } from 'lucide-react';

interface SepaQrCodeProps {
  iban?: string;
  bic?: string;
  beneficiaryName: string;
  amount: number;
  reference: string;
  size?: number;
  compact?: boolean;
  className?: string;
}

/**
 * Generates an official EPC SEPA Credit Transfer (SCT) QR Code payload.
 * Specification: European Payments Council (EPC069-12)
 */
export function generateEpcQrPayload({
  iban = '',
  bic = '',
  beneficiaryName,
  amount,
  reference
}: {
  iban?: string;
  bic?: string;
  beneficiaryName: string;
  amount: number;
  reference: string;
}): string {
  const cleanIban = iban.replace(/\s+/g, '').toUpperCase();
  const cleanBic = bic.replace(/\s+/g, '').toUpperCase();
  const cleanName = beneficiaryName.trim().slice(0, 70);
  // EPC format specifies amount as EUR12.34
  const formattedAmount = `EUR${amount.toFixed(2)}`;
  // Clean reference up to 140 chars
  const cleanRef = reference.trim().slice(0, 140);

  // Line structure for EPC QR code
  const lines = [
    'BCD',                      // Service Tag
    '002',                      // Version
    '1',                        // Character set (1 = UTF-8)
    'SCT',                      // Identification code
    cleanBic,                   // BIC
    cleanName,                  // Beneficiary Name
    cleanIban,                  // IBAN
    formattedAmount,            // Amount
    '',                         // Purpose code (empty)
    '',                         // Structured remittance reference (empty)
    cleanRef,                   // Unstructured remittance text (invoice ref)
    ''                          // Beneficiary to originator info
  ];

  return lines.join('\n');
}

export const SepaQrCode: React.FC<SepaQrCodeProps> = ({
  iban,
  bic,
  beneficiaryName,
  amount,
  reference,
  size = 110,
  compact = false,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!iban) {
    return null;
  }

  const payload = generateEpcQrPayload({
    iban,
    bic,
    beneficiaryName,
    amount,
    reference
  });

  const formattedIban = iban.replace(/(.{4})/g, '$1 ').trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 ${className}`}>
        <div 
          className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm shrink-0 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => setShowModal(true)}
          title="Cliquez pour agrandir le QR Code de paiement SEPA"
        >
          <QRCodeSVG 
            value={payload} 
            size={size} 
            level="M" 
            includeMargin={false}
          />
        </div>

        <div className="flex flex-col text-left space-y-0.5 min-w-0">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
            <QrCode size={12} className="text-blue-600 shrink-0" />
            <span>Paiement SEPA par QR Code</span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">
            Scannez avec votre appli bancaire pour payer <strong className="text-slate-900 font-mono font-bold">{amount.toFixed(2)} €</strong> instantanément.
          </p>
          <span className="text-[9px] font-mono text-slate-400 truncate">Ref: {reference}</span>
        </div>

        {/* Modal display when clicked */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 no-print">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-center space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Smartphone size={18} className="text-blue-600" />
                  <span>Scanner le QR Code SEPA</span>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-center">
                <QRCodeSVG 
                  value={payload} 
                  size={200} 
                  level="M" 
                  includeMargin={true}
                />
              </div>

              <div className="text-xs text-slate-600 space-y-1 text-left bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                <p><strong>Bénéficiaire :</strong> {beneficiaryName}</p>
                <p><strong>Montant :</strong> <span className="font-mono font-bold text-blue-700">{amount.toFixed(2)} €</span></p>
                <p className="truncate"><strong>IBAN :</strong> <span className="font-mono">{formattedIban}</span></p>
                <p><strong>Motif / Réf :</strong> <span className="font-mono">{reference}</span></p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <QrCode size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">QR Code Virement SEPA (EPC Standard)</h4>
            <p className="text-[10.5px] text-slate-500">Préréglé pour les applications bancaires européennes</p>
          </div>
        </div>
        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-widest flex items-center gap-1">
          <ShieldCheck size={12} /> GiroCode / SCT
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0 shadow-xs">
          <QRCodeSVG 
            value={payload} 
            size={130} 
            level="M" 
            includeMargin={true}
          />
        </div>

        <div className="space-y-2 text-xs text-slate-600 flex-1 w-full">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Bénéficiaire</span>
              <span className="font-bold text-slate-900">{beneficiaryName}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Montant à Régler</span>
              <span className="font-mono font-black text-blue-600 text-sm">{amount.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-bold uppercase text-[9px]">IBAN Destinataire</span>
              <span className="font-mono text-slate-800 text-[10.5px] font-semibold">{formattedIban}</span>
            </div>
            {bic && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-bold uppercase text-[9px]">BIC / SWIFT</span>
                <span className="font-mono text-slate-700">{bic}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-bold uppercase text-[9px]">Référence / Motif</span>
              <span className="font-mono text-slate-800 font-bold">{reference}</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5 leading-normal">
            <Info size={13} className="text-blue-500 shrink-0" />
            <span>Votre client n'a plus besoin d'entrer manuellement votre IBAN ni la référence. Il suffit de tout scanner.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
