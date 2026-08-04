use crate::models::{Invoice, InvoiceItem};
use crate::errors::AppError;

/// Service for financial arithmetic (calcul des totaux) and state transitions.
pub struct InvoiceService;

impl InvoiceService {
    /// Safely computes the financial totals of an invoice using integer-cents arithmetic
    /// to avoid any floating-point representation bugs or IEEE 754 precision drift.
    /// Returns: (subtotal_cents, discount_cents, total_ht_cents, vat_cents, total_ttc_cents, due_cents)
    pub fn calculate_totals(
        items: &[InvoiceItem],
        discount_rate: f64, // e.g., 10.0 for 10%
        shipping: f64,      // expressed in euros
        deposit: f64,       // expressed in euros
    ) -> Result<(i64, i64, i64, i64, i64, i64), AppError> {
        if discount_rate < 0.0 || discount_rate > 100.0 {
            return Err(AppError::Validation("Le taux de remise doit être compris entre 0 et 100%.".to_string()));
        }
        if shipping < 0.0 {
            return Err(AppError::Validation("Les frais de port ne peuvent pas être négatifs.".to_string()));
        }
        if deposit < 0.0 {
            return Err(AppError::Validation("L'acompte ne peut pas être négatif.".to_string()));
        }

        // 1. Calculate base subtotal in cents
        let mut subtotal_cents: i64 = 0;
        for item in items {
            if item.quantity < 0.0 {
                return Err(AppError::Validation("La quantité d'un article ne peut pas être négative.".to_string()));
            }
            if item.unit_price < 0.0 {
                return Err(AppError::Validation("Le prix unitaire ne peut pas être négatif.".to_string()));
            }

            // Convert unit price directly to cents (rounding to closest integer)
            let price_cents = (item.unit_price * 100.0).round() as i64;
            let item_total_cents = (price_cents as f64 * item.quantity).round() as i64;
            subtotal_cents += item_total_cents;
        }

        // 2. Compute discount in cents
        let discount_cents = if discount_rate > 0.0 {
            ((subtotal_cents as f64) * (discount_rate / 100.0)).round() as i64
        } else {
            0
        };

        // 3. Subtotal HT in cents (subtotal - discount)
        let subtotal_ht_cents = subtotal_cents - discount_cents;

        // 4. Incorporate shipping (converted to cents)
        let shipping_cents = (shipping * 100.0).round() as i64;
        let total_ht_cents = subtotal_ht_cents + shipping_cents;

        // 5. Compute VAT in cents
        // We accumulate VAT per line or globally depending on rates. For this first phase,
        // we aggregate based on the primary document VAT rate.
        let mut total_vat_cents: i64 = 0;
        for item in items {
            let item_price_cents = (item.unit_price * 100.0).round() as i64;
            let item_total_cents = (item_price_cents as f64 * item.quantity).round() as i64;
            
            // Deduct proportional discount from item line if discount exists
            let proportional_discount_cents = if subtotal_cents > 0 {
                ((item_total_cents as f64) * (discount_cents as f64 / subtotal_cents as f64)).round() as i64
            } else {
                0
            };
            
            let line_ht_cents = item_total_cents - proportional_discount_cents;
            let line_vat_cents = ((line_ht_cents as f64) * (item.vat_rate / 100.0)).round() as i64;
            total_vat_cents += line_vat_cents;
        }

        // 6. Calculate total TTC
        let total_ttc_cents = total_ht_cents + total_vat_cents;

        // 7. Deduct deposit (acompte)
        let deposit_cents = (deposit * 100.0).round() as i64;
        let due_cents = i64::max(0, total_ttc_cents - deposit_cents);

        Ok((
            subtotal_cents,
            discount_cents,
            total_ht_cents,
            total_vat_cents,
            total_ttc_cents,
            due_cents,
        ))
    }

    /// Checks and executes transitions of document status.
    /// Returns Ok(new_status) if transition is valid, or a BusinessRule error.
    pub fn validate_transition(current_status: &str, target_status: &str) -> Result<String, AppError> {
        let current = current_status.to_uppercase();
        let target = target_status.to_uppercase();

        if current == target {
            return Ok(target);
        }

        match current.as_str() {
            "DRAFT" => {
                if target == "SENT" || target == "CANCELLED" {
                    Ok(target)
                } else {
                    Err(AppError::BusinessRule(format!(
                        "Transition de statut invalide : Impossible de passer de {} à {}.",
                        current, target
                    )))
                }
            }
            "SENT" => {
                if target == "PAID" || target == "OVERDUE" || target == "CANCELLED" {
                    Ok(target)
                } else {
                    Err(AppError::BusinessRule(format!(
                        "Transition de statut invalide : Impossible de passer de {} à {}.",
                        current, target
                    )))
                }
            }
            "OVERDUE" => {
                if target == "PAID" || target == "CANCELLED" {
                    Ok(target)
                } else {
                    Err(AppError::BusinessRule(format!(
                        "Transition de statut invalide : Impossible de passer de {} à {}.",
                        current, target
                    )))
                }
            }
            "PAID" | "CANCELLED" => {
                Err(AppError::BusinessRule(format!(
                    "Règle comptable : Une facture au statut {} est finale et ne peut plus être modifiée.",
                    current
                )))
            }
            _ => Err(AppError::BusinessRule(format!(
                "Statut de facture inconnu ou non pris en charge : {}.",
                current
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_totals_with_discounts_and_taxes() {
        let items = vec![
            InvoiceItem {
                description: "Conseil technique".to_string(),
                quantity: 2.0,
                unit_price: 150.0, // 300.00 euros
                vat_rate: 20.0,
            },
            InvoiceItem {
                description: "Frais de déplacement".to_string(),
                quantity: 1.0,
                unit_price: 50.55, // 50.55 euros
                vat_rate: 10.0,
            },
        ];

        // Raw subtotal = 350.55 €
        // Discount 10% on raw subtotal => 35.055 € rounded = 35.06 €
        // Remaining Subtotal HT = 315.49 €
        // Shipping = 20.00 €
        // Total HT = 335.49 €
        // VAT calculation:
        // - Item 1: 300.00 - (300/350.55 * 35.06) = 300.00 - 30.01 = 269.99 € HT -> VAT 20% = 54.00 €
        // - Item 2: 50.55 - (50.55/350.55 * 35.06) = 50.55 - 5.05 = 45.50 € HT -> VAT 10% = 4.55 €
        // Total VAT = 58.55 €
        // Total TTC = 335.49 + 58.55 = 394.04 €
        // Deposit = 100.00 €
        // Reste à payer = 294.04 €

        let result = InvoiceService::calculate_totals(&items, 10.0, 20.0, 100.0);
        assert!(result.is_ok());
        
        let (subtotal, discount, total_ht, vat, total_ttc, due) = result.unwrap();
        assert_eq!(subtotal, 35055);
        assert_eq!(discount, 3506);
        assert_eq!(total_ht, 33549);
        assert_eq!(vat, 5855);
        assert_eq!(total_ttc, 39404);
        assert_eq!(due, 29404);
    }

    #[test]
    fn test_valid_status_transitions() {
        // DRAFT -> SENT
        let res1 = InvoiceService::validate_transition("DRAFT", "SENT");
        assert_eq!(res1.unwrap(), "SENT");

        // SENT -> PAID
        let res2 = InvoiceService::validate_transition("SENT", "PAID");
        assert_eq!(res2.unwrap(), "PAID");

        // OVERDUE -> CANCELLED
        let res3 = InvoiceService::validate_transition("OVERDUE", "CANCELLED");
        assert_eq!(res3.unwrap(), "CANCELLED");
    }

    #[test]
    fn test_invalid_status_transitions() {
        // PAID -> DRAFT is forbidden (Comptabilité analytique de traçabilité)
        let res1 = InvoiceService::validate_transition("PAID", "DRAFT");
        assert!(res1.is_err());

        // DRAFT -> PAID direct transition is invalid
        let res2 = InvoiceService::validate_transition("DRAFT", "PAID");
        assert!(res2.is_err());
    }
}
