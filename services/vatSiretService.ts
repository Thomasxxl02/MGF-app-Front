/**
 * Utility for validating SIRET/SIREN (Luhn algorithm) and French/EU Intra-community VAT numbers (VIES format & auto-derivation).
 */

/**
 * Validates a SIREN (9 digits) or SIRET (14 digits) using the Luhn checksum algorithm.
 */
export function validateSiretLuhn(siretOrSiren: string): { valid: boolean; isSiret: boolean; message: string; siren?: string } {
  const clean = siretOrSiren.replace(/\s+/g, '');
  
  if (!/^\d+$/.test(clean)) {
    return { valid: false, isSiret: false, message: "Le SIRET/SIREN ne doit contenir que des chiffres." };
  }

  if (clean.length !== 9 && clean.length !== 14) {
    return { valid: false, isSiret: clean.length === 14, message: `Longueur incorrecte (${clean.length} chiffres). Doit faire 9 (SIREN) ou 14 chiffres (SIRET).` };
  }

  // Luhn algorithm verification
  let sum = 0;
  for (let i = 0; i < clean.length; i++) {
    let digit = parseInt(clean.charAt(clean.length - 1 - i), 10);
    // Multiply every second digit from right by 2
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  const isValid = sum % 10 === 0;
  const isSiret = clean.length === 14;
  const siren = clean.slice(0, 9);

  return {
    valid: isValid,
    isSiret,
    siren,
    message: isValid 
      ? `Numéro ${isSiret ? 'SIRET' : 'SIREN'} valide (Clé de Luhn OK)` 
      : `Numéro ${isSiret ? 'SIRET' : 'SIREN'} invalide (Échec de la clé de contrôle Luhn)`
  };
}

/**
 * Derives a French Intra-community VAT Number (TVA Intracommunautaire) from a valid 9-digit SIREN.
 * Formula for FR VAT Key: (12 + 3 * (SIREN % 97)) % 97
 */
export function deriveFrenchVatFromSiren(sirenOrSiret: string): string | null {
  const clean = sirenOrSiret.replace(/\s+/g, '');
  if (clean.length < 9) return null;
  const sirenNum = parseInt(clean.slice(0, 9), 10);
  if (isNaN(sirenNum)) return null;

  const key = (12 + 3 * (sirenNum % 97)) % 97;
  const keyStr = key < 10 ? `0${key}` : `${key}`;

  return `FR${keyStr}${clean.slice(0, 9)}`;
}

/**
 * Validates format for EU VAT numbers (VIES compliant regex standards).
 */
export function validateViesVatFormat(vatNumber: string): { valid: boolean; countryCode: string; message: string } {
  const clean = vatNumber.replace(/[\s\.-]/g, '').toUpperCase();
  
  if (clean.length < 4) {
    return { valid: false, countryCode: '', message: "Numéro de TVA trop court." };
  }

  const countryCode = clean.slice(0, 2);
  const numberPart = clean.slice(2);

  const vatRegexes: Record<string, RegExp> = {
    FR: /^([A-HJ-NP-Z0-9]{2})\d{9}$/,
    DE: /^\d{9}$/,
    BE: /^0?\d{9}$/,
    ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
    IT: /^\d{11}$/,
    NL: /^\d{9}B\d{2}$/,
    LU: /^\d{8}$/,
    PT: /^\d{9}$/,
    IE: /^\d{7}[A-[Z]|^\d[A-Z0-9]\d{5}[A-Z]$/,
    AT: /^U\d{8}$/,
    PL: /^\d{10}$/,
    GB: /^(\d{9}|\d{12}|(GD|HA)\d{3})$/
  };

  const regex = vatRegexes[countryCode];
  if (!regex) {
    // Generic fallback for other EU countries
    return {
      valid: /^[A-[Z]{2}[A-Z0-9]{4,12}$/.test(clean),
      countryCode,
      message: `Format TVA pour le pays ${countryCode}`
    };
  }

  const isValid = regex.test(numberPart);

  return {
    valid: isValid,
    countryCode,
    message: isValid 
      ? `Format TVA Intracommunautaire (${countryCode}) valide !`
      : `Structure TVA Intracommunautaire invalide pour le pays ${countryCode}.`
  };
}
