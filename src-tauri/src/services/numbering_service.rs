use crate::errors::AppError;

/// Sequential unique document numbering generator
pub struct NumberingService;

impl NumberingService {
    /// Generates a unique, non-modifiable sequential document number based on format rules.
    /// Format: PREFIX-YYYY-MM-XXXXXX (e.g., FAC-2026-08-000042)
    ///
    /// # Arguments
    /// * `prefix` - "FAC", "DEV", "AVO", etc.
    /// * `year` - Current numerical year.
    /// * `month` - Current numerical month.
    /// * `last_sequence` - The highest current sequence number in the database for this company.
    pub fn generate_document_number(
        prefix: &str,
        year: i32,
        month: i32,
        last_sequence: i64,
    ) -> Result<String, AppError> {
        if prefix.trim().is_empty() {
            return Err(AppError::Validation("Le préfixe ne peut pas être vide.".to_string()));
        }
        if year < 2000 || year > 2100 {
            return Err(AppError::Validation("L'année fournie est invalide.".to_string()));
        }
        if month < 1 || month > 12 {
            return Err(AppError::Validation("Le mois fourni est invalide.".to_string()));
        }

        let next_sequence = last_sequence + 1;
        
        // Formats correctly with zero-padding (6 digits)
        let formatted_number = format!(
            "{}-{:04}-{:02}-{:06}",
            prefix.to_uppercase(),
            year,
            month,
            next_sequence
        );

        Ok(formatted_number)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_number_generation() {
        let result = NumberingService::generate_document_number("FAC", 2026, 8, 41);
        assert!(result.is_ok());
        let number = result.unwrap();
        assert_eq!(number, "FAC-2026-08-000042");
    }

    #[test]
    fn test_empty_prefix_fails() {
        let result = NumberingService::generate_document_number("   ", 2026, 8, 5);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Validation(msg) => assert!(msg.contains("Le préfixe ne peut pas être vide")),
            _ => panic!("Expected a validation error"),
        }
    }

    #[test]
    fn test_invalid_dates_fail() {
        let result_year = NumberingService::generate_document_number("FAC", 1999, 8, 5);
        assert!(result_year.is_err());

        let result_month = NumberingService::generate_document_number("FAC", 2026, 13, 5);
        assert!(result_month.is_err());
    }

    #[test]
    fn test_sequence_increment() {
        let num_1 = NumberingService::generate_document_number("DEV", 2026, 1, 0).unwrap();
        let num_2 = NumberingService::generate_document_number("DEV", 2026, 1, 1).unwrap();
        assert_eq!(num_1, "DEV-2026-01-000001");
        assert_eq!(num_2, "DEV-2026-01-000002");
    }
}
