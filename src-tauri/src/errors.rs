#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Erreur de base de données : {0}")]
    Database(String),

    #[error("Erreur de validation : {0}")]
    Validation(String),

    #[error("Élément introuvable : {0}")]
    NotFound(String),

    #[error("Violation des règles de gestion : {0}")]
    BusinessRule(String),
    
    #[error("Erreur d'I/O système : {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
