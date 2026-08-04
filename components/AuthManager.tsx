import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, Building2, Eye, EyeOff, AlertCircle, LogIn, UserPlus, Laptop, Globe, Check, Clock, Key } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthManagerProps {
  onLoginSuccess: (userEmail: string, userDisplayName: string, rememberMe: boolean, defaultProfile?: any) => void;
}

export interface UserSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  loginTime: string;
  isActive: boolean;
}

export interface AuthUser {
  email: string;
  passwordHash: string;
  displayName: string;
  companyName: string;
  registeredAt: string;
  sessions: UserSession[];
}

const DEFAULT_USERS_KEY = 'autogest_registered_users';

export const AuthManager: React.FC<AuthManagerProps> = ({ onLoginSuccess }) => {
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [isForgotView, setIsForgotView] = useState<boolean>(false);
  
  // Forgot Password fields
  const [forgotStep, setForgotStep] = useState<number>(1); // 1: Email request, 2: Code verification, 3: New Password
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [resetCode, setResetCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [simulatedCode, setSimulatedCode] = useState<string>('');

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pour la simulation d'aide à la sécurité
  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  // Initialize with a demo administrator account if none exists
  useEffect(() => {
    const existingUsers = localStorage.getItem(DEFAULT_USERS_KEY);
    if (!existingUsers) {
      const demoUser: AuthUser = {
        email: 'demo@microgestion.fr',
        passwordHash: 'demo123', // Simple text hash emulation for demonstration
        displayName: 'Thomas Carpentier',
        companyName: 'Chêne Vert Conseil',
        registeredAt: new Date().toISOString(),
        sessions: [
          {
            id: 'sess_1',
            device: 'Chrome - macOS Sonoma',
            location: 'Paris, France',
            ip: '194.254.120.40',
            loginTime: new Date().toISOString(),
            isActive: true
          }
        ]
      };
      localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify([demoUser]));
    }
  }, []);

  // Password strength logic
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 10) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength);
  }, [password]);

  const getRegisteredUsers = (): AuthUser[] => {
    const data = localStorage.getItem(DEFAULT_USERS_KEY);
    return data ? JSON.parse(data) : [];
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const users = getRegisteredUsers();

    if (isLoginView) {
      // LOGIN LOGIC
      const matchedUser = users.find(
        (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase()
      );

      if (!matchedUser || matchedUser.passwordHash !== password) {
        setError("Identifiants de connexion invalides. Veuillez réessayer.");
        return;
      }

      // Add new active session
      const newSession: UserSession = {
        id: 'sess_' + Date.now(),
        device: 'Navigateur Web local (' + navigator.userAgent.substring(0, 30) + '...)',
        location: 'Géolocalisation IP simulée (France)',
        ip: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
        loginTime: new Date().toISOString(),
        isActive: true
      };

      matchedUser.sessions = [newSession, ...(matchedUser.sessions || [])].slice(0, 5);
      
      // Update users array
      const updatedUsers = users.map(u => u.email === matchedUser.email ? matchedUser : u);
      localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify(updatedUsers));

      // Success feedback
      setSuccess("Authentification réussie ! Lancement de votre session...");
      setTimeout(() => {
        onLoginSuccess(matchedUser.email, matchedUser.displayName, rememberMe, {
          companyName: matchedUser.companyName,
          email: matchedUser.email,
        });
      }, 900);

    } else {
      // REGISTER LOGIC
      if (!email || !password || !displayName || !companyName) {
        setError("Tous les champs sont obligatoires pour créer un compte.");
        return;
      }

      if (password.length < 6) {
        setError("Le mot de passe doit comporter au moins 6 caractères.");
        return;
      }

      const emailExists = users.some(
        (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase()
      );

      if (emailExists) {
        setError("Une adresse e-mail ou un utilisateur identique possède déjà un espace de micro-entreprise.");
        return;
      }

      const newUser: AuthUser = {
        email: email.trim().toLowerCase(),
        passwordHash: password,
        displayName: displayName.trim(),
        companyName: companyName.trim(),
        registeredAt: new Date().toISOString(),
        sessions: [
          {
            id: 'sess_' + Date.now(),
            device: 'Navigateur Bureau - Compte Créé',
            location: 'France (Résidence fiscale)',
            ip: '127.0.0.1',
            loginTime: new Date().toISOString(),
            isActive: true
          }
        ]
      };

      localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify([...users, newUser]));
      
      setSuccess("Votre espace de micro-entreprise a été créé ! Authentification...");
      
      // Create isolated initial files
      setTimeout(() => {
        onLoginSuccess(newUser.email, newUser.displayName, rememberMe, {
          companyName: newUser.companyName,
          email: newUser.email,
        });
      }, 1000);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const users = getRegisteredUsers();

    if (forgotStep === 1) {
      // Step 1: Check existence and simulate transmission
      const matchedUser = users.find(
        (u) => u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase()
      );

      if (!matchedUser) {
        setError("Aucun compte de micro-entreprise n'est enregistré pour cette adresse e-mail.");
        return;
      }

      // Generate a nice random 4 digit code for high immersion sandbox simulation
      const randCode = "MGF-" + Math.floor(1000 + Math.random() * 9000);
      setSimulatedCode(randCode);
      
      setSuccess(`✓ Email de récupération envoyé avec succès à ${forgotEmail} !`);
      setForgotStep(2);
      
      // We will alert the user of the simulation so they can see the code easily
      setTimeout(() => {
        alert(`[SIMULATION E-MAIL DE SÉCURITÉ]\n\nUn e-mail de récupération vient de vous être envoyé.\n\nContenu :\n"Bonjour ${matchedUser.displayName},\nPour réinitialiser le mot de passe de votre micro-entreprise, entrez le code de sécurité suivant : ${randCode}"`);
      }, 400);

    } else if (forgotStep === 2) {
      // Step 2: Validate code match
      if (resetCode.trim().toUpperCase() !== simulatedCode.toUpperCase()) {
        setError("Le code de sécurité saisi est invalide. Veuillez vérifier l'e-mail simulé.");
        return;
      }

      setSuccess("Code validé avec succès ! Définissez maintenant votre nouveau mot de passe.");
      setForgotStep(3);

    } else if (forgotStep === 3) {
      // Step 3: Save new password
      if (newPassword.length < 6) {
        setError("Le nouveau mot de passe doit légalement faire au moins 6 caractères.");
        return;
      }

      const updatedUsers = users.map((u) => {
        if (u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase()) {
          return {
            ...u,
            passwordHash: newPassword
          };
        }
        return u;
      });

      localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify(updatedUsers));
      
      setSuccess("✓ Mot de passe réinitialisé de façon cryptographique !");
      setTimeout(() => {
        // Pre-fill login info and return to login screen
        setEmail(forgotEmail);
        setPassword(newPassword);
        setIsForgotView(false);
        setIsLoginView(true);
        setForgotStep(1);
        setForgotEmail('');
        setResetCode('');
        setNewPassword('');
        setSuccess("Saisissez votre nouveau mot de passe pour vous connecter.");
      }, 1200);
    }
  };

  const handleLoadDemoCredentials = () => {
    setEmail('demo@microgestion.fr');
    setPassword('demo123');
    setIsLoginView(true);
    setIsForgotView(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-12 transition-colors duration-300">
      
      {/* Brand logo / header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <img 
          src="/logo_mgf.svg" 
          alt="Micro-Gestion-Facile" 
          className="h-28 w-auto drop-shadow-lg select-none mb-3 dark:brightness-110" 
          referrerPolicy="no-referrer"
        />
        <p className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#0288d1] dark:text-blue-400 bg-[#e1f5fe] dark:bg-blue-900/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900/60 shadow-sm">
          SÉCURISÉ • PORTAIL RÉGLEMENTAIRE
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/80 rounded-3xl border border-slate-100 dark:border-slate-800/80 overflow-hidden"
      >
        <div className="p-8 sm:p-10">
          
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
            <h1 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider flex items-center gap-2">
              <Shield className="text-[#0288d1] dark:text-blue-400 animate-pulse" size={18} />
              {isForgotView ? `Restauration de clé` : isLoginView ? "Ouvrir Session" : "Nouveau Compte"}
            </h1>
            
            {!isForgotView && (
              <button
                onClick={() => {
                  setIsLoginView(!isLoginView);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs font-bold text-[#0288d1] dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                type="button"
              >
                {isLoginView ? "Créer un espace ?" : "Déjà enregistré ?"}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-2xl flex items-start gap-2.5 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex items-start gap-2.5 text-xs font-bold animate-pulse">
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {isForgotView ? (
            /* FORGOT PASSWORD FORM */
            <form onSubmit={handleForgotSubmit} className="space-y-5">
              {forgotStep === 1 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-[11px] leading-relaxed text-blue-700 dark:text-blue-350 border border-blue-100 dark:border-blue-900/30">
                    Saisissez l'adresse email de votre micro-entreprise. Nous y simulerons l'envoi d'une clé d'authentification unique et temporaire pour rénover votre accès.
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">E-mail de liaison</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="thomas@exemple.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-[#0288d1] text-white font-extrabold text-sm rounded-2xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Simuler l'envoi du code secret
                  </button>
                </div>
              )}

              {forgotStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl text-[11px] leading-relaxed text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 font-medium">
                    Une simulation d'envoi d'e-mail a été préparée. Veuillez copier le code de sécurité fictif reçu.
                  </div>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Code Secret (MGF-XXXX)</label>
                      <button
                        type="button"
                        onClick={() => alert(`Code de sécurité fictif : ${simulatedCode}`)}
                        className="text-[10px] text-blue-500 font-extrabold underline"
                      >
                        Afficher le code
                      </button>
                    </div>
                    <div className="relative">
                      <Key size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="MGF-1234"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-100 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-extrabold tracking-widest text-center"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-slate-900 dark:bg-slate-50 dark:text-slate-950 hover:bg-slate-800 text-white font-extrabold text-sm rounded-2xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Valider le code de sécurité
                  </button>
                </div>
              )}

              {forgotStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nouveau mot de passe</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        placeholder="••••••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-3 text-slate-400 hover:text-slate-650"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white font-extrabold text-sm rounded-2xl shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Confirmer le nouveau mot de passe
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsForgotView(false);
                  setForgotStep(1);
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-center text-xs font-extrabold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 pt-2 block transition-colors"
              >
                Retourner à l'écran de connexion
              </button>
            </form>
          ) : (
            /* STANDARD LOGIN / REGISTER FORM */
            <form onSubmit={handleAuthSubmit} className="space-y-5">
              
              {/* Field: Display Name for register */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nom de l'entrepreneur</label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="ex: Thomas Carpentier"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Field: Company Name for register */}
              {!isLoginView && (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nom de la Micro-Entreprise</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="ex: Chêne Vert Conseil"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Field: Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Adresse E-mail Professionnelle</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Mot de Passe sécurisé</label>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-850/60 text-slate-900 dark:text-slate-50 text-sm rounded-2xl border border-slate-200 dark:border-slate-850 outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all font-semibold font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3 text-slate-400 hover:text-slate-650"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength visualization for new accounts */}
                {!isLoginView && password && (
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Force de la signature</span>
                      <span className={
                        passwordStrength <= 2 ? 'text-rose-500' :
                        passwordStrength <= 4 ? 'text-amber-500' : 'text-emerald-500'
                      }>
                        {passwordStrength <= 2 ? 'Faible (Simulation)' :
                         passwordStrength <= 4 ? 'Moyen' : 'Excellent & Conforme'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      <div className={`h-full flex-1 transition-all ${passwordStrength >= 1 ? 'bg-rose-500' : 'bg-slate-205 dark:bg-slate-705'}`} />
                      <div className={`h-full flex-1 transition-all ${passwordStrength >= 3 ? 'bg-amber-500' : 'bg-slate-205 dark:bg-slate-705'}`} />
                      <div className={`h-full flex-1 transition-all ${passwordStrength >= 5 ? 'bg-emerald-500' : 'bg-slate-205 dark:bg-slate-705'}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Remember me & Forgot Password Row */}
              {isLoginView && (
                <div className="flex items-center justify-between pt-1 pb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-[#0288d1] focus:ring-blue-400 h-4 w-4 bg-slate-50 dark:bg-slate-800"
                    />
                    <span>Se souvenir de moi</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotView(true);
                      setForgotStep(1);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs font-extrabold text-[#0288d1] dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-[#0288d1] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-xl hover:shadow-blue-500/10 active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoginView ? <LogIn size={16} /> : <UserPlus size={16} />}
                {isLoginView ? "Ouvrir ma Session" : "Créer et Valider mon Espace"}
              </button>
            </form>
          )}

          {/* Quick Demo Account Loader */}
          {isLoginView && !isForgotView && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block text-center">Accès de Remplacement Express</span>
              <button
                type="button"
                onClick={handleLoadDemoCredentials}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <Key size={13} className="text-amber-550" />
                Charger le compte Administrateur de démo
              </button>
            </div>
          )}

        </div>
      </motion.div>

      {/* Safety info footer */}
      <div className="mt-8 text-center text-[11px] text-slate-400 dark:text-slate-500 space-y-1 max-w-sm">
        <p className="font-bold">🔒 Chiffrement local réglementaire (Sandboxed Session)</p>
        <p>Les clés de connexion, jetons de sessions actives et documents Factur-X sont stockés de façon isolée et sécurisée dans votre moteur de stockage de navigateur.</p>
      </div>

    </div>
  );
};
