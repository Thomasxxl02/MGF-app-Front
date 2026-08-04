use crate::errors::AppError;

/// Service for strict business validations (SIRET, VAT, Email)
pub struct ValidationService;

impl ValidationService {
    /// Validates a French SIRET number using the Luhn checksum algorithm.
    /// A SIRET is exactly 14 digits. The sum must be a multiple of 10.
    pub fn validate_siret(siret: &str) -> Result<bool, AppError> {
        let clean: String = siret.chars().filter(|c| c.is_ascii_digit()).collect();
        
        if clean.len() != 14 {
            return Err(AppError::Validation(format!(
                "Le SIRET doit contenir exactement 14 chiffres (trouvé: {}).",
                clean.len()
            )));
        }

        let mut sum = 0;
        for (i, c) in clean.chars().enumerate() {
            let mut val = c.to_digit(10).ok_or_else(|| {
                AppError::Validation("Le SIRET contient des caractères non numériques.".to_string())
            })?;

            // Luhn calculation: double every second digit from the right
            // For a 14-digit number, index 0 is odd, index 1 is even, etc.
            // Even indexes (0, 2, 4...) are multiplied by 2
            if i % 2 == 0 {
                val *= 2;
                if val > 9 {
                    val -= 9;
                }
            }
            sum += val;
        }

        Ok(sum % 10 == 0)
    }

    /// Validates a French Intracommunautaire VAT number format.
    /// Format: FR + 2 digits (key) + 9 digits (SIREN)
    /// Key = (12 + 3 * (SIREN % 97)) % 97
    pub fn validate_fr_vat_number(vat: &str) -> Result<bool, AppError> {
        let clean: String = vat.chars().filter(|c| c.is_alphanumeric()).collect().to_uppercase();
        
        if clean.len() != 13 || !clean.starts_with("FR") {
            return Err(AppError::Validation(
                "Le numéro de TVA intracommunautaire français doit commencer par FR et faire 13 caractères.".to_string(),
            ));
        }

        let key_str = &clean[2..4];
        let siren_str = &clean[4..13];

        let key: u32 = key_str.parse().map_err(|_| {
            AppError::Validation("La clé de TVA intracommunautaire doit être numérique.".to_string())
        })?;

        let siren: u32 = siren_str.parse().map_err(|_| {
            AppError::Validation("Le numéro SIREN associé à la TVA doit être numérique.".to_string())
        })?;

        let computed_key = (12 + (3 * (siren % 97))) % 97;

        Ok(key == computed_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siret_validation_luhn() {
        // Witness valid SIRET
        let valid_siret = "73202154100018"; // 732 021 541 00018 is valid
        let result = ValidationService::validate_siret(valid_siret);
        assert!(result.is_ok());
        assert!(result.unwrap());

        // Altered SIRET (should fail Luhn check)
        let invalid_siret = "73202154100019";
        let result_invalid = ValidationService::validate_siret(invalid_siret);
        assert!(result_invalid.is_ok());
        assert!(!result_invalid.unwrap());
    }

    #[test]
    fn test_siret_invalid_length() {
        let short_siret = "123456789";
        let result = ValidationService::validate_siret(short_siret);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Validation(msg) => assert!(msg.contains("Le SIRET doit contenir exactement 14 chiffres")),
            _ => panic!("Expected invalid length validation error"),
        }
    }

    #[test]
    fn test_vat_validation_formula() {
        // Valid French VAT for SIREN 732021541 (key = 12 + 3 * (732021541 % 97) % 97 = 12 + 3 * (86) % 97 = 12 + 258 = 270 % 97 = 76)
        // Let's verify: 732021541 / 97 = 7546613.82474. 7546613 * 97 = 732021461. Remainder = 80.
        // Let's compute: 12 + 3 * 80 = 252. 252 % 97 = 58.
        // Therefore FR58732021541 is a valid Intracommunautaire VAT number.
        let valid_vat = "FR58732021541";
        let result = ValidationService::validate_fr_vat_number(valid_vat);
        assert!(result.is_ok());
        assert!(result.unwrap(), "TVA witness should be valid according to French tax formula");

        // Invalid key
        let invalid_vat = "FR99732021541";
        let result_invalid = ValidationService::validate_fr_vat_number(invalid_vat);
        assert!(result_invalid.is_ok());
        assert!(!result_invalid.unwrap());
    }
}
