import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// ====================================================================
// ARCHITECTURE DE TEST FRONTEND POUR TAURI 2.x + REACT
// Ce fichier configure l'environnement de test global (jsdom) et
// fournit les mocks nécessaires pour simuler l'IPC natif de Tauri.
// ====================================================================

// 1. Mock de l'API globale Tauri IPC
const mockTauriIPC = {
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
};

beforeEach(() => {
  // Injecter l'objet global Tauri simulé pour les composants sous test
  (window as any).__TAURI__ = {
    core: {
      invoke: mockTauriIPC.invoke,
    },
    event: {
      listen: mockTauriIPC.listen,
      emit: mockTauriIPC.emit,
    }
  };

  // Réinitialiser les mocks entre chaque test pour éviter la pollution d'état
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  // Nettoyages additionnels après chaque cas de test
});

// Helper utilitaire pour simuler des réponses d'IPC Tauri spécifiques
export const mockTauriCommand = (commandName: string, mockReturnValue: any) => {
  mockTauriIPC.invoke.mockImplementation((cmd: string, args?: any) => {
    if (cmd === commandName) {
      return Promise.resolve(mockReturnValue);
    }
    return Promise.reject(new Error(`Commande Tauri non mockée: ${cmd}`));
  });
};

// Helper pour simuler des erreurs de commande Tauri
export const mockTauriCommandError = (commandName: string, errorMessage: string) => {
  mockTauriIPC.invoke.mockImplementation((cmd: string, _args?: any) => {
    if (cmd === commandName) {
      return Promise.reject(new Error(errorMessage));
    }
    return Promise.reject(new Error(`Commande Tauri non mockée: ${cmd}`));
  });
};
