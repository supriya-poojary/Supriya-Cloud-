import React, { useState } from 'react';
import { User, Lock, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function Auth() {
    const [isRegister, setIsRegister] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const Navigate = useNavigate();
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [form, setForm] = useState({ username: '', password: '' });
    const [resetForm, setResetForm] = useState({ username: '', newPassword: '' });
    const [googleEmail, setGoogleEmail] = useState('');
    const [error, setError] = useState('');

    const toggleAuth = () => {
        setIsRegister(!isRegister);
        setIsForgotPassword(false);
        setError('');
    };

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        if (!form.username || !form.password) {
            setError('Please enter username and password');
            return;
        }

        // Retrieve users from local storage
        const storedUsers = JSON.parse(localStorage.getItem('cloudbox_users') || '{}');
        const storedPassword = storedUsers[form.username];

        if (storedPassword) {
            // User exists, check password
            if (form.password === storedPassword) {
                login(form.username);
                toast.success("Welcome back!");
                navigate('/dashboard');
            } else {
                setError('Incorrect password');
            }
        } else {
            // User does not exist
            setError('User not found. Please Sign Up first.');
        }
    };

    const handleRegister = (e) => {
        e.preventDefault();
        setError('');

        if (!form.username || !form.password) {
            toast.error("Please fill in all fields");
            return;
        }

        // Basic email validation
        if (!form.username.includes('@') || !form.username.includes('.')) {
            toast.error("Please enter a valid email address");
            return;
        }

        const storedUsers = JSON.parse(localStorage.getItem('cloudbox_users') || '{}');

        if (storedUsers[form.username]) {
            toast.error("User already exists. Please Login.");
            return;
        }

        // Save new user
        storedUsers[form.username] = form.password;
        localStorage.setItem('cloudbox_users', JSON.stringify(storedUsers));

        login(form.username);
        toast.success("Account created successfully! Logging in...");

        // Auto-login after signup
        setTimeout(() => {
            navigate('/dashboard');
        }, 1000);
    };

    const handleResetPassword = (e) => {
        e.preventDefault();
        if (!resetForm.newPassword) return;

        localStorage.setItem('demo_password', resetForm.newPassword);

        setIsForgotPassword(false);
        setForm(prev => ({ ...prev, password: '' })); // Clear login password
        alert("Password reset successfully! You can now login with your new password.");
    };


    return (
        <div className="flex items-center justify-center min-h-[600px] w-full p-4 relative z-20">

            {/* Specific CSS for the requested animation */}
            <style>{`
        .auth-container {
            position: relative;
            width: 850px;
            max-width: 95vw;
            height: 550px;
            background: #111827;
            border-radius: 30px;
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
            overflow: hidden;
            border: 2px solid rgba(255, 122, 87, 0.3);
            transition: all 0.3s ease;
        }

        @media (max-width: 768px) {
            .auth-container {
                width: 400px;
                height: 650px;
            }
            .form-box {
                width: 100% !important;
                height: 80% !important;
                top: 0;
            }
            .form-box.Register {
                transform: translateY(100%);
            }
            .auth-container.active .form-box.Register {
                transform: translateY(0);
            }
            .auth-container.active .form-box.Login {
                transform: translateY(-100%);
                opacity: 0;
            }
            .toggle-box {
                width: 100% !important;
                height: 20% !important;
                top: 80% !important;
                left: 0 !important;
                border-radius: 30px 30px 0 0 !important;
            }
            .auth-container.active .toggle-box {
                top: 80% !important;
                left: 0 !important;
            }
            .toggle-panel {
                height: 100% !important;
            }
            .toggle-panel h1 {
                font-size: 1.5rem !important;
                margin-bottom: 0.5rem !important;
            }
            .toggle-panel p {
                display: none;
            }
            .form-box h2 {
                font-size: 2rem !important;
            }
        }

        @media (max-width: 480px) {
            .auth-container {
                width: 100%;
                height: 600px;
                border-radius: 20px;
            }
        }

        .form-box {
            position: absolute;
            left: 0; /* Form on Left */
            width: 50%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            z-index: 10;
            transition: all 0.6s ease-in-out;
        }

        .form-box.Register {
            opacity: 0;
            z-index: 5;
            pointer-events: none;
            transform: translateX(100%);
        }

        .auth-container.active .form-box.Register {
            opacity: 1;
            z-index: 10;
            pointer-events: auto;
            transform: translateX(100%);
        }

        .form-box.Login {
            z-index: 10;
        }

        .auth-container.active .form-box.Login {
            transform: translateX(100%); /* Move to Right (hidden behind overlay?) No, overlay moves Left. */
            /* Actually, if overlay moves left, Login (Left) should disappear or move. */
            opacity: 0;
            pointer-events: none;
        }

        /* Specific Animation for Inputs */
        .form-box .animation {
            transform: translateX(120%);
            opacity: 0;
            filter: blur(10px);
            transition: .7s ease;
        }

        .auth-container.active .form-box.Register .animation {
            transform: translateX(0%);
            opacity: 1;
            filter: blur(0);
            transition-delay: calc(.1s * var(--i));
        }

        .auth-container:not(.active) .form-box.Login .animation {
            transform: translateX(0%);
            opacity: 1;
            filter: blur(0);
            transition-delay: calc(.1s * var(--i));
        }
        
        /* Toggle Box (Overlay) */
        .toggle-box {
            position: absolute;
            top: 0;
            left: 50%; /* Overlay starts on Right */
            width: 50%;
            height: 100%;
            overflow: hidden;
            transition: all 0.6s ease-in-out;
            z-index: 100;
            border-radius: 150px 0 0 100px;
        }

        .auth-container.active .toggle-box {
            left: 0; /* Overlay moves to Left */
            border-radius: 0 150px 100px 0;
        }

        .toggle-box::before {
            content: '';
            position: absolute;
            height: 100%;
            width: 200%;
            background: linear-gradient(135deg, #ff7a57, #d8482d, #0f172a);
            top: 0;
            left: -100%; /* Gradient alignment */
            transition: all 0.6s ease-in-out;
        }

        .auth-container.active .toggle-box::before {
            left: 0;
        }

        .toggle-panel {
            position: absolute;
            width: 50%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #fff;
            z-index: 2;
            transition: all 0.6s ease-in-out;
            top: 0;
            transform: translateX(0);
        }

        /* Right Panel (Welcome) - Visible initially inside Right Overlay */
        .toggle-panel.toggle-right {
            right: 0;
            transform: translateX(0);
        }

        /* Left Panel (Hello Again) - Hidden initially? */
        /* Since Toggle Box is half-width, we need to position panels inside IT. */
        /* The Toggle Box translates, wrapping the panels. */
        /* Actually, simpler approach: Toggle Box is the container. */
        /* Inside Toggle Box (50% wide): */
        /*   If at Right: we show Toggle Right. */
        /*   If at Left: we show Toggle Left. */
        
        /* Let's double the width of content inside? */
        /* Standard trick: Toggle Panel Left is at Left: 0 (of 200% width container?) */
        /* Let's stick to the simplest visual: absolute panels relative to toggle-box. */
        
        .toggle-panel.toggle-left {
            transform: translateX(-200%); /* Hidden to left */
        }
        
        .auth-container.active .toggle-panel.toggle-left {
            transform: translateX(0); /* Visible when overlay is on left */
             /* Since overlay is on Left, Left panel is inside it. */
             /* Wait, toggle-box width is 50%. Panel width is 50%? No 100% of box. */
        }
        
        .toggle-panel { width: 100% !important; }

        .auth-container.active .toggle-panel.toggle-right {
            transform: translateX(200%); /* Move out to right */
        }

      `}</style>

            <div className={`auth-container ${isRegister ? 'active' : ''} glass`}>

                {/* Login Form */}
                <div className="form-box Login text-white">
                    <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
                        {!isForgotPassword ? (
                            <>
                                <h2 className="text-4xl font-bold mb-2 animation" style={{ '--i': 0 }}>Login</h2>

                                <div className="relative animation" style={{ '--i': 1 }}>
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        aria-label="Username"
                                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all"
                                        placeholder="Username"
                                    />
                                </div>

                                <div className="relative animation" style={{ '--i': 2 }}>
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        required
                                        aria-label="Password"
                                        value={form.password}
                                        onChange={(e) => {
                                            setForm({ ...form, password: e.target.value });
                                            if (error) setError('');
                                        }}
                                        className={`w-full bg-[#0f172a] border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all ${error ? 'border-red-500' : 'border-white/10'
                                            }`}
                                        placeholder="Password"
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-500 text-xs text-right mt-[-10px] animation" style={{ '--i': 2 }}>
                                        {error}
                                    </p>
                                )}

                                <div className="text-right animation" style={{ '--i': 3 }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotPassword(true)}
                                        className="text-sm text-[#ff7a57] hover:text-[#ff8a6b] transition-colors"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>

                                <button
                                    className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-[#ff7a57] to-[#d8482d] font-bold text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform animation"
                                    style={{ '--i': 3 }}
                                >
                                    Login
                                </button>
                            </>
                        ) : (
                            <>
                                <h2 className="text-3xl font-bold mb-2 animation" style={{ '--i': 0 }}>Reset Password</h2>
                                <p className="text-sm text-slate-400 mb-4 animation" style={{ '--i': 0 }}>Enter your new password to regain access.</p>

                                <div className="relative animation" style={{ '--i': 1 }}>
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        required
                                        aria-label="Username/Email"
                                        value={resetForm.username}
                                        onChange={(e) => setResetForm({ ...resetForm, username: e.target.value })}
                                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all"
                                        placeholder="Username or Email"
                                    />
                                </div>

                                <div className="relative animation" style={{ '--i': 2 }}>
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="password"
                                        required
                                        aria-label="New Password"
                                        value={resetForm.newPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                                        className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all"
                                        placeholder="New Password"
                                    />
                                </div>

                                <button
                                    onClick={handleResetPassword}
                                    className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-[#ff7a57] to-[#d8482d] font-bold text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform animation"
                                    style={{ '--i': 3 }}
                                >
                                    Set New Password
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsForgotPassword(false)}
                                    className="w-full mt-2 text-sm text-slate-400 hover:text-white transition-colors animation"
                                    style={{ '--i': 4 }}
                                >
                                    Back to Login
                                </button>
                            </>
                        )}

                        <p className="text-center text-slate-400 text-sm animation" style={{ '--i': 5 }}>
                            <button onClick={() => navigate('/')} className="text-[#ff7a57] hover:underline">Go Home</button>
                        </p>
                    </form>
                </div>

                {/* Register/Google Form */}
                <div className="form-box Register text-white">
                    <form onSubmit={handleRegister} className="w-full flex flex-col gap-6 items-center justify-center h-full">
                        <h2 className="text-4xl font-bold mb-4 animation" style={{ '--i': 0 }}>Sign Up</h2>

                        <div className="w-full relative animation" style={{ '--i': 1 }}>
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="email"
                                required
                                aria-label="Username"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all"
                                placeholder="Enter New Email"
                            />
                        </div>

                        <div className="w-full relative animation" style={{ '--i': 2 }}>
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                required
                                aria-label="Password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-[#ff7a57] focus:border-transparent outline-none transition-all"
                                placeholder="Enter New Password"
                            />
                        </div>

                        <button
                            className="w-full py-3 rounded-xl bg-white text-slate-900 font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all animation"
                            style={{ '--i': 3 }}
                        >
                            Sign Up
                        </button>
                    </form>
                </div>

                {/* Toggle Panel Overlay */}
                <div className="toggle-box">
                    <div className="toggle-panel toggle-left">
                        <h1 className="text-3xl font-bold mb-4">Hello Again!</h1>
                        <p className="mb-8 text-center px-8">Welcome back to the future of cloud storage.</p>
                        <button onClick={toggleAuth} className="border-2 border-white px-8 py-2 rounded-xl font-bold hover:bg-white hover:text-[#d8482d] transition-colors">
                            Login
                        </button>
                    </div>

                    <div className="toggle-panel toggle-right">
                        <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
                        <p className="mb-8 text-center px-8">Join us and experience infinite possibilities.</p>
                        <button onClick={toggleAuth} className="border-2 border-white px-8 py-2 rounded-xl font-bold hover:bg-white hover:text-[#d8482d] transition-colors flex items-center gap-2">
                            Sign Up
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
