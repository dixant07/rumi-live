"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MailCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { useGuest } from '@/lib/contexts/GuestContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trackSignUp, trackLogin } from '@/lib/utils/analytics';

export default function SignupPage() {
    const router = useRouter();
    const { joinAsGuest } = useGuest();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailSent, setEmailSent] = useState(false);

    // Guest form state
    const [guestName, setGuestName] = useState('');
    const [guestGender, setGuestGender] = useState<'male' | 'female'>('male');
    const [guestError, setGuestError] = useState('');

    const syncUserWithBackend = async (token: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to sync user with backend');
            }
            return await response.json();
        } catch (err) {
            console.error("Backend sync error:", err);
            throw err;
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const displayName = `${firstName} ${lastName}`.trim();
            await updateProfile(userCredential.user, { displayName });
            await sendEmailVerification(userCredential.user);
            trackSignUp('email'); // ← Analytics
            setEmailSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        try {
            const userCredential = await signInWithPopup(auth, googleProvider);
            const token = await userCredential.user.getIdToken();
            const data = await syncUserWithBackend(token);
            trackLogin('google'); // ← Analytics (Google on signup page = login)

            if (data?.user && !data.user.isOnboarded) {
                router.push('/onboarding');
            } else {
                router.push('/home');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to login with Google');
        } finally {
            setLoading(false);
        }
    };

    const handleGuestJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName.trim()) {
            setGuestError('Please enter your name');
            return;
        }
        trackSignUp('guest'); // ← Analytics
        joinAsGuest(guestName.trim(), guestGender);
        router.push('/video/chat');
    };

    if (emailSent) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md shadow-xl text-center">
                    <CardHeader>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                            <MailCheck className="h-6 w-6 text-orange-600" />
                        </div>
                        <CardTitle className="mt-4 text-xl font-semibold text-gray-900">Check your email</CardTitle>
                        <CardDescription className="mt-2">
                            We&apos;ve sent a verification link to <span className="font-medium text-orange-600">{email}</span>. Please verify your email to continue.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Once you have verified your email, click the button below to log in.
                        </p>
                        <Button
                            className="w-full bg-orange-500 hover:bg-orange-600"
                            onClick={() => router.push('/login')}
                        >
                            Proceed to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="flex w-full max-w-4xl gap-6 flex-col lg:flex-row">
                {/* Left: Signup Form */}
                <Card className="flex-1 shadow-xl">
                    <CardHeader className="space-y-1">
                        <div className="flex justify-center mb-4">
                            <img src="/logo.svg" alt="Rumi" className="h-12 w-auto" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-orange-600">Create an account</CardTitle>
                        <CardDescription className="text-center">
                            Enter your details below to create your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                        id="firstName"
                                        type="text"
                                        placeholder="John"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        type="text"
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign Up'}
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or</span>
                            </div>
                        </div>

                        <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Google
                        </Button>

                        <p className="text-sm text-gray-500 text-center">
                            Already have an account?{' '}
                            <Link href="/login" className="text-orange-600 hover:underline font-medium">
                                Login
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                {/* Divider */}
                <div className="hidden lg:flex items-center">
                    <div className="h-full w-px bg-gray-200" />
                </div>
                <div className="lg:hidden flex items-center justify-center">
                    <div className="flex items-center gap-4 w-full">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-sm text-gray-400">or</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>
                </div>

                {/* Right: Guest Join */}
                <Card className="flex-1 shadow-xl border-2 border-dashed border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                    <CardHeader className="space-y-1">
                        <div className="flex justify-center mb-4">
                            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                                <Zap className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold text-center text-orange-600">Try Instantly</CardTitle>
                        <CardDescription className="text-center">
                            Don&apos;t want to sign up now? Jump right in as a guest!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {guestError && (
                            <div className="bg-red-50 text-red-500 text-sm p-3 rounded-md">
                                {guestError}
                            </div>
                        )}
                        <form onSubmit={handleGuestJoin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="guestName">Your Name</Label>
                                <Input
                                    id="guestName"
                                    type="text"
                                    placeholder="Enter your name"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="guestGender">I am</Label>
                                <Select value={guestGender} onValueChange={(v) => setGuestGender(v as 'male' | 'female')}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">
                                <Zap className="mr-2 h-4 w-4" />
                                Join as Guest
                            </Button>
                        </form>

                        <div className="text-center text-sm text-gray-500 mt-4">
                            <p>✓ No email required</p>
                            <p>✓ Start chatting instantly</p>
                            <p className="text-xs text-gray-400 mt-2">Session will reset on page refresh</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
