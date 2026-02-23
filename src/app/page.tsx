"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/AuthContext';
import { useGuest } from '@/lib/contexts/GuestContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  Gamepad2,
  Users,
  MessageCircle,
  Shield,
  Zap,
  Globe,
  Star,
  Play,
  ChevronRight,
  Sparkles,
  Heart,
  ArrowRight,
  ChevronLeft,
  UserCircle
} from 'lucide-react';
// import Video from 'next-video'; // We will use standard video tag for now to ensure compatibility with duplicated files in /videos if next-video component has issues
import { ComponentProps } from 'react';

function HeroVideoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const videos = [
    'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/rumi-2.webm?alt=media&token=5bb76bf7-f01f-4c8f-8127-75fda5278e84',
  ];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  };

  return (
    <div className="relative w-full h-full group">
      <video
        key={currentIndex} // Force re-render on change
        src={videos[currentIndex]}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover transition-opacity duration-500"
        poster="/rumi-poster.jpg"
      />

      {/* Controls Overlay - Visible on Group Hover */}
      <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={(e) => { e.preventDefault(); handlePrev(); }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors border border-white/20"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); handleNext(); }}
          className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors border border-white/20"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {videos.map((_, idx) => (
          <div
            key={idx}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, loading } = useUser();
  const { joinAsGuest, isGuest } = useGuest();
  const router = useRouter();

  // Guest join form state
  const [guestName, setGuestName] = useState('');
  const [guestGender, setGuestGender] = useState<'male' | 'female' | ''>('');
  const [guestError, setGuestError] = useState('');
  const [isJoiningAsGuest, setIsJoiningAsGuest] = useState(false);

  const handleGuestJoin = () => {
    setGuestError('');

    if (!guestName.trim()) {
      setGuestError('Please enter your name');
      return;
    }
    if (!guestGender) {
      setGuestError('Please select your gender');
      return;
    }

    setIsJoiningAsGuest(true);
    try {
      joinAsGuest(guestName, guestGender);
      router.push('/video/chat');
    } catch (error) {
      console.error('Failed to join as guest:', error);
      setGuestError('Failed to join. Please try again.');
      setIsJoiningAsGuest(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      router.push('/home');
    }
    // If already a guest, redirect to video chat
    if (isGuest) {
      router.push('/video/chat');
    }
  }, [user, loading, router, isGuest]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-900 overflow-x-hidden selection:bg-orange-100 selection:text-orange-900">

      {/* Ambient Background Mesh */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-100/40 rounded-full blur-[120px] mix-blend-multiply animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-pink-100/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02]"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
        ? 'bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm'
        : 'bg-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative h-9 w-9 group-hover:scale-105 transition-transform duration-300">
              <Image
                src="/logo.svg"
                alt="Rumi"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">
              Rumi
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-zinc-600 hover:text-zinc-900 font-medium transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="text-zinc-600 hover:text-zinc-900 font-medium transition-colors duration-200">How It Works</a>
            <a href="#games" className="text-zinc-600 hover:text-zinc-900 font-medium transition-colors duration-200">Games</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 font-medium">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90 text-white shadow-lg shadow-orange-500/20 transition-all duration-300 rounded-full px-6">
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-white/50 mb-8 backdrop-blur-md shadow-sm animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-600">The most fun way to meet people</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[1.1] tracking-tight">
            <span className="block text-zinc-900 drop-shadow-sm">Stop Swiping.</span>
            <span className="block text-zinc-900 drop-shadow-sm">Start Playing.</span>
            <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 bg-clip-text text-transparent">
              Welcome to Rumi.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-zinc-600 max-w-3xl mx-auto mb-4 leading-relaxed font-medium">
            Don’t Just Watch. <span className="text-zinc-900 font-bold">Play.</span> <span className="text-zinc-900 font-bold">Talk.</span> <span className="text-zinc-900 font-bold">Connect.</span>
          </p>

          <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-8 leading-relaxed">
            Meet amazing people from around the world. Video chat with high quality, break the ice with fun mini-games, and make lasting connections.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link href="/signup">
              <Button size="lg" className="h-16 bg-zinc-900 hover:bg-zinc-800 text-white text-xl px-10 rounded-full shadow-2xl shadow-zinc-300 hover:shadow-orange-500/20 hover:scale-105 transition-all duration-300 border border-zinc-800">
                <Play className="w-6 h-6 mr-2 fill-current" />
                Start Rumi-ing
              </Button>
            </Link>
            <a href="#demo-video" onClick={(e) => {
              e.preventDefault();
              document.getElementById('demo-video')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              <Button size="lg" variant="outline" className="h-16 bg-white/50 border-white/60 hover:bg-white text-zinc-700 text-xl px-10 rounded-full shadow-lg shadow-zinc-100 backdrop-blur-sm transition-all duration-300">
                Watch Demo
              </Button>
            </a>
          </div>

          {/* Guest Join Section */}
          <div className="max-w-md mx-auto mb-16">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-zinc-200"></div>
              <span className="text-sm text-zinc-500 font-medium">or try instantly</span>
              <div className="flex-1 h-px bg-zinc-200"></div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/60">
              <div className="flex items-center gap-2 mb-4">
                <UserCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-zinc-700">Join as Guest</span>
              </div>

              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="h-12 rounded-xl border-zinc-200 focus:border-orange-500 focus:ring-orange-500"
                    maxLength={30}
                  />
                </div>

                <div>
                  <Select
                    value={guestGender}
                    onValueChange={(value: 'male' | 'female') => setGuestGender(value)}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-zinc-200 focus:border-orange-500 focus:ring-orange-500">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {guestError && (
                  <p className="text-red-500 text-sm">{guestError}</p>
                )}

                <Button
                  onClick={handleGuestJoin}
                  disabled={isJoiningAsGuest}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-300"
                >
                  {isJoiningAsGuest ? 'Joining...' : 'Join Now'}
                </Button>

                <p className="text-xs text-zinc-400 text-center">
                  No signup required. Start video chatting instantly!
                </p>
              </div>
            </div>
          </div>

          {/* Hero Video/Visual */}
          <div id="demo-video" className="relative max-w-5xl mx-auto scroll-mt-32">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-600 rounded-[2rem] blur-3xl opacity-10 -z-10 transform scale-105"></div>
            <div className="relative bg-white/40 border border-white/60 rounded-[2rem] p-3 backdrop-blur-xl shadow-2xl shadow-zinc-200/50">
              <div className="aspect-video bg-black rounded-[1.5rem] overflow-hidden relative group border border-white/50">
                <HeroVideoCarousel />
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mt-24">
            {[
              { number: "1M+", label: "Active Users" },
              { number: "50M+", label: "Connections" },
              { number: "4.9", label: "App Store Rating" },
              { number: "150+", label: "Countries" },
            ].map((stat, index) => (
              <div key={index} className="text-center group p-4 rounded-2xl hover:bg-white/50 transition-colors duration-300">
                <div className="text-4xl font-bold text-zinc-900 mb-2 group-hover:scale-110 transition-transform duration-300 inline-block font-mono tracking-tighter">
                  {stat.number}
                </div>
                <div className="text-zinc-500 font-medium text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-zinc-900 tracking-tight">
              Why people love Rumi
            </h2>
            <p className="text-zinc-600 text-xl max-w-2xl mx-auto">
              We've redesigned the video chat experience from the ground up to be more social, engaging, and fun.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Video,
                title: "Crystal Clear Video",
                description: "Experience 1080p video quality with ultra-low latency. It feels like you're in the same room.",
                color: "text-blue-500",
                bg: "bg-blue-50"
              },
              {
                icon: Gamepad2,
                title: "Social Gaming",
                description: "Don't just talk—play! Challenge friends to Knife Throw, Tic-Tac-Toe, and more while you chat.",
                color: "text-orange-500",
                bg: "bg-orange-50"
              },
              {
                icon: Users,
                title: "Smart Matching",
                description: "Our AI uses interests and personality traits to find people you'll actually click with.",
                color: "text-purple-500",
                bg: "bg-purple-50"
              },
              {
                icon: Shield,
                title: "Safe & Secure",
                description: "Advanced AI moderation and strict privacy controls keep your experience positive and safe.",
                color: "text-emerald-500",
                bg: "bg-emerald-50"
              },
              {
                icon: MessageCircle,
                title: "Rich Chat",
                description: "Express yourself with reactions, GIFs, and stickers when words aren't enough.",
                color: "text-pink-500",
                bg: "bg-pink-50"
              },
              {
                icon: Globe,
                title: "Global Reach",
                description: "Connect instantly with people from over 150 countries. The world is at your fingertips.",
                color: "text-indigo-500",
                bg: "bg-indigo-50"
              }
            ].map((feature, index) => (
              <Card key={index} className="border-0 bg-white/60 backdrop-blur-xl shadow-lg shadow-zinc-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-3xl overflow-hidden group">
                <CardContent className="p-8 h-full flex flex-col items-start">
                  <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`w-7 h-7 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-3">{feature.title}</h3>
                  <p className="text-zinc-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 relative z-10 bg-white/40 backdrop-blur-sm border-y border-white/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-zinc-900 tracking-tight">
              You’re the Frick. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">We Found Your Frack.</span>
            </h2>
            <p className="text-zinc-600 text-xl max-w-2xl mx-auto font-medium">
              Start making friends in under 60 seconds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-[100px] left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-transparent via-zinc-200 to-transparent"></div>

            {[
              {
                step: "01",
                title: "Sign Up",
                desc: "Create your profile in seconds.",
                emoji: "👋"
              },
              {
                step: "02",
                title: "Get Matched",
                desc: "We find people you'll like.",
                emoji: "🤝"
              },
              {
                step: "03",
                title: "Have Fun",
                desc: "Chat, play, and connect.",
                emoji: "🎉"
              }
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center group">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-lg shadow-zinc-100 flex items-center justify-center text-3xl mb-8 relative z-10 border border-zinc-100 group-hover:scale-110 transition-transform duration-300">
                  {item.emoji}
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">{item.title}</h3>
                <p className="text-zinc-500 max-w-[200px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section id="games" className="py-24 px-0 z-10 relative overflow-hidden bg-gradient-to-b from-transparent to-white/50">
        <div className="max-w-7xl mx-auto px-6 mb-16">
          <div className="text-center">
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-zinc-900 tracking-tighter uppercase">
              Game On. <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-600">Camera On.</span>
            </h2>
            <p className="text-zinc-600 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
              Awkward silences are a thing of the past. Jump into a game and let the fun begin.
            </p>
          </div>
        </div>

        <div className="relative w-full overflow-hidden pb-12 group/slider">
          <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused] w-max px-6">
            {[
              {
                name: "Knife Throw",
                desc: "Test your aim",
                img: "/knife-throw.png",
                color: "bg-orange-500"
              },
              {
                name: "Tic-Tac-Toe",
                desc: "Classic strategy",
                img: "/tic-tac-toe.png",
                color: "bg-pink-500"
              },
              {
                name: "Connect Four",
                desc: "Connect and win",
                img: "/connect-four.png",
                color: "bg-purple-500"
              },
              {
                name: "Ping Pong",
                desc: "Fast paced action",
                img: "/ping-pong.png",
                color: "bg-blue-500"
              },
              {
                name: "Bowling",
                desc: "Strike it big",
                img: "/bowling.png",
                color: "bg-emerald-500"
              },
              {
                name: "Darts",
                desc: "Hit the bullseye",
                img: "/darts.png",
                color: "bg-red-500"
              },
              {
                name: "Doodle Guess",
                desc: "Draw and guess",
                img: "/doodle-guess.png",
                color: "bg-yellow-500"
              },
              {
                name: "Dumb Charades",
                desc: "Act it out",
                img: "/dumb-charades.png",
                color: "bg-cyan-500"
              },
              {
                name: "Many More...",
                desc: "Coming soon",
                isMore: true,
                color: "bg-zinc-800"
              }
            ].map((game, i) => (
              <div key={i} className="relative w-72 h-96 flex-shrink-0 rounded-[2rem] overflow-hidden group cursor-pointer shadow-xl shadow-zinc-200/50 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white">
                {game.isMore ? (
                  <div className="absolute inset-0 bg-zinc-100 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-zinc-300">
                    <div className="w-20 h-20 rounded-full bg-zinc-200 flex items-center justify-center mb-6">
                      <Gamepad2 className="w-10 h-10 text-zinc-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 mb-2">And Many More</h3>
                    <p className="text-zinc-500">We are constantly adding new games!</p>
                  </div>
                ) : (
                  <>
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${game.color}`}></div>
                    <div className="h-2/3 p-8 flex items-center justify-center bg-zinc-50 group-hover:scale-105 transition-transform duration-500 relative">
                      <Image
                        src={game.img!}
                        alt={game.name}
                        fill
                        className="object-contain drop-shadow-xl p-2"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-white p-6 border-t border-zinc-100 flex flex-col justify-center">
                      <h3 className="text-xl font-bold text-zinc-900 mb-1">{game.name}</h3>
                      <p className="text-zinc-500 text-sm font-medium">{game.desc}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 z-10 relative">
        <div className="max-w-5xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-pink-500 rounded-[3rem] opacity-10 blur-2xl transform -rotate-1"></div>

          <div className="relative bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 shadow-2xl shadow-orange-500/10 overflow-hidden px-8 py-20 text-center">

            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-200/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight text-zinc-900 relative z-10 leading-tight">
              Ready to meet your<br />
              <span className="bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">new best friend?</span>
            </h2>

            <p className="text-xl text-zinc-600 mb-10 max-w-xl mx-auto relative z-10">
              Join over 1 million users today. No credit card required.
            </p>

            <Link href="/signup" className="relative z-10 inline-block">
              <Button size="lg" className="h-16 px-12 bg-black hover:bg-zinc-800 text-white rounded-full text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                Get Started for Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200/60 bg-white/40 backdrop-blur-sm z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-zinc-900">Rumi</span>
            <span className="text-zinc-400 text-sm">© 2024</span>
          </div>

          <div className="flex items-center gap-8 text-sm font-medium text-zinc-600">
            <a href="#" className="hover:text-zinc-900">Privacy</a>
            <a href="#" className="hover:text-zinc-900">Terms</a>
            <a href="#" className="hover:text-zinc-900">Contact</a>
          </div>

          <div className="flex items-center gap-4">
            {['twitter', 'instagram', 'youtube'].map((social) => (
              <a key={social} href="#" className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                <span className="sr-only">{social}</span>
                <div className="w-4 h-4 bg-zinc-400 rounded-sm"></div>
              </a>
            ))}
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          50% { transform: translateX(calc(-100% + 100vw)); }
          100% { transform: translateX(0); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
