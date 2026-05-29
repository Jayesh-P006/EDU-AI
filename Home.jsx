import { useState, useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/draggable';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
    Briefcase as BriefcaseIcon,
    Bot as RobotIcon,
    Check as CheckIcon,
    Video as VideoIcon,
    Shield as ShieldIcon,
    Brain as BrainIcon,
    Zap as ZapIcon,
    Dumbbell as DumbbellIcon,
    Code as CodeIcon,
    Target as TargetIcon,
    ArrowRight as ArrowRightIcon,
    Users as UsersIcon,
    BarChart3 as BarChartIcon,
    Globe as GlobeIcon,
    ChevronDown as ChevronDownIcon,
    Sparkles as SparklesIcon,
    MousePointerClick as MouseIcon,
} from 'lucide-react';
import './Home.css';

gsap.registerPlugin(Draggable, ScrollTrigger);

/* ── Animated counter hook ── */
function useCounter(end, duration = 2000, startCounting = false) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!startCounting) return;
        let start = 0;
        const inc = end / (duration / 16);
        const timer = setInterval(() => {
            start += inc;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration, startCounting]);
    return count;
}

/* ── Floating Particles ── */
function FloatingParticles() {
    const particles = useMemo(() =>
        Array.from({ length: 40 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            duration: Math.random() * 20 + 15,
            delay: Math.random() * 10,
        })), []);

    return (
        <div className="floating-particles">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="particle"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
                    animate={{
                        y: [0, -30, 0, 30, 0],
                        x: [0, 15, -15, 10, 0],
                        opacity: [0, 0.6, 0.3, 0.6, 0],
                    }}
                    transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ── Animated Grid Background ── */
function GridBackground() {
    return (
        <div className="grid-bg">
            <div className="grid-lines" />
            <div className="grid-glow glow-1" />
            <div className="grid-glow glow-2" />
            <div className="grid-glow glow-3" />
        </div>
    );
}

/* ── Scroll-reveal wrapper ── */
function ScrollReveal({ children, className = '', delay = 0, direction = 'up' }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-80px' });
    const dirs = { up: [40, 0], down: [-40, 0], left: [0, 0], right: [0, 0] };
    const [y] = dirs[direction] || dirs.up;

    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y, scale: 0.97 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            {children}
        </motion.div>
    );
}

/* ── Navbar ── */
function Navbar() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.nav
            className={`navbar ${scrolled ? 'scrolled' : ''}`}
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
        >
            <div className="container navbar-inner">
                <motion.div className="navbar-brand" whileHover={{ scale: 1.05 }}>
                    <TargetIcon size={22} />
                    <span>HireSpec</span>
                </motion.div>
                <div className="navbar-links">
                    <a href="#features">Features</a>
                    <a href="#modes">Solutions</a>
                    <a href="#stats">Impact</a>
                </div>
                <div className="navbar-actions">
                    <button className="btn btn-nav-login" onClick={() => navigate('/login')}>Sign In</button>
                    <motion.button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/register')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Get Started
                    </motion.button>
                </div>
            </div>
        </motion.nav>
    );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, value, suffix, label, delay }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });
    const count = useCounter(value, 2000, isInView);

    return (
        <motion.div
            ref={ref}
            className="stat-card"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay }}
            whileHover={{ y: -6, borderColor: 'rgba(255,255,255,0.15)' }}
        >
            <div className="stat-icon"><Icon size={22} /></div>
            <div className="stat-value">{count}{suffix}</div>
            <div className="stat-label">{label}</div>
        </motion.div>
    );
}

/* ── Mode Card ── */
function ModeCard({ icon: Icon, badge, badgeAccent, title, description, features, delay, alwaysVisible }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-60px' });
    const isVisible = alwaysVisible || isInView;

    return (
        <motion.div
            ref={ref}
            className="mode-card"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{
                opacity: alwaysVisible ? 1 : (isVisible ? 1 : 0),
                y: isVisible ? 0 : 50,
                scale: isVisible ? 1 : 0.95
            }}
            transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{
                y: -12,
                scale: 1.02,
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)"
            }}
            whileTap={{ scale: 0.98 }}
        >
            <div className="mode-card-header">
                <motion.div
                    className="mode-icon"
                    whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                >
                    <Icon size={28} />
                </motion.div>
                <div className={`mode-badge ${badgeAccent ? 'accent' : ''}`}>{badge}</div>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <ul className="feature-list">
                {features.map((f, i) => (
                    <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={isVisible ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.4, delay: delay + 0.1 + i * 0.07 }}
                    >
                        <CheckIcon size={16} /><span>{f}</span>
                    </motion.li>
                ))}
            </ul>
        </motion.div>
    );
}

/* ── Feature Card ── */
function FeatureCard({ icon: Icon, title, description, delay }) {
    const cardRef = useRef(null);

    useEffect(() => {
        if (!cardRef.current) return;

        // Entrance animation
        gsap.fromTo(cardRef.current,
            { opacity: 0, y: 40, scale: 0.95 },
            {
                opacity: 1, y: 0, scale: 1, duration: 0.6, delay: delay,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: cardRef.current,
                    start: "top 85%",
                    toggleActions: "play none none none"
                },
                onComplete: () => {
                    // Continuous floating animation after entrance
                    gsap.to(cardRef.current, {
                        y: "-=30", // Increased vertical travel height
                        duration: 0.6, // Even faster speed
                        yoyo: true,
                        repeat: -1,
                        ease: "sine.inOut"
                    });
                }
            }
        );

        return () => {
            gsap.killTweensOf(cardRef.current);
        };
    }, [delay]);

    return (
        <motion.div
            ref={cardRef}
            className="feature-card"
            whileHover={{ scale: 1.02 }}
        >
            <motion.div
                className="feature-icon"
                whileHover={{ rotate: 360, scale: 1.15 }}
                transition={{ duration: 0.6 }}
            >
                <Icon size={32} />
            </motion.div>
            <h3>{title}</h3>
            <p>{description}</p>
        </motion.div>
    );
}

/* Typewriter removed – replaced by GSAP blur-stagger animation */

/* ── Scroll-down indicator ── */
function ScrollIndicator() {
    return (
        <motion.div
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
        >
            <span>Scroll to explore</span>
            <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                <ChevronDownIcon size={18} />
            </motion.div>
        </motion.div>
    );
}

/* ── Straight Reveal Text Component ── */
function RevealText({ text }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const chars = containerRef.current.querySelectorAll('.reveal-char');

        gsap.fromTo(chars,
            { opacity: 0, x: -10 },
            {
                opacity: 1,
                x: 0,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top 85%",
                    toggleActions: "play none none none"
                }
            }
        );

        return () => {
            // Cleanup if needed
        };
    }, []);

    return (
        <span ref={containerRef} style={{ display: 'inline-block' }}>
            {text.split('').map((char, i) => (
                <span
                    key={i}
                    className="reveal-char"
                    style={{
                        display: 'inline-block',
                        margin: '0 8px', /* Added letter spacing */
                        whiteSpace: char === ' ' ? 'pre' : 'normal',
                    }}
                >
                    {char}
                </span>
            ))}
        </span>
    );
}

/* ── Bubble Text Component ── */
function BubbleText({ text, className = "" }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const chars = containerRef.current.querySelectorAll('.bubble-char');

        // Main entrance pop-in
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top 85%",
                toggleActions: "play none none none"
            }
        });

        tl.fromTo(chars,
            {
                opacity: 0,
                y: 40,
                scale: 0.1,
                rotate: "random(-20, 20)",
                filter: "blur(10px)"
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                rotate: 0,
                filter: "blur(0px)",
                duration: 1.2,
                stagger: {
                    each: 0.04,
                    from: "random"
                },
                ease: "back.out(2)"
            }
        );

        // Continuous floating bubble effect
        chars.forEach((char, i) => {
            gsap.to(char, {
                y: "-=10",
                x: "random(-4, 4)",
                rotate: "random(-3, 3)",
                duration: "random(2, 3)",
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                delay: i * 0.05
            });
        });

        return () => {
            if (tl.scrollTrigger) tl.scrollTrigger.kill();
            tl.kill();
            gsap.killTweensOf(chars);
        };
    }, []);

    const handleMouseEnter = (e) => {
        const char = e.currentTarget;
        gsap.to(char, {
            scale: 1.4,
            color: '#c08f5f',
            textShadow: '0 0 20px rgba(192, 143, 95, 0.4)',
            duration: 0.4,
            ease: "back.out(4)"
        });
    };

    const handleMouseLeave = (e) => {
        const char = e.currentTarget;
        gsap.to(char, {
            scale: 1,
            color: 'inherit',
            textShadow: 'none',
            duration: 0.6,
            ease: "elastic.out(1, 0.3)"
        });
    };

    return (
        <h2 ref={containerRef} className={`bubble-container ${className}`}>
            {text.split('').map((char, i) => (
                <span
                    key={i}
                    className="bubble-char"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        display: 'inline-block',
                        whiteSpace: char === ' ' ? 'pre' : 'normal',
                        cursor: 'default',
                        transformOrigin: '50% 100%'
                    }}
                >
                    {char === ' ' ? '\u00A0' : char}
                </span>
            ))}
        </h2>
    );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
function Home() {
    const navigate = useNavigate();
    const { scrollYProgress } = useScroll();
    const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.96]);
    const titleRef = useRef(null);
    const subtitleRef = useRef(null);
    const glow1Ref = useRef(null);
    const glow2Ref = useRef(null);
    const ringRef = useRef(null);
    const wrapperRef = useRef(null);


    // ──────────────────────────────────────────────
    // ── 3D MODE CAROUSEL GSAP ──
    // ──────────────────────────────────────────────
    useEffect(() => {
        if (!ringRef.current || !wrapperRef.current) return;

        const ring = ringRef.current;
        const wrapper = wrapperRef.current;
        let xPos = 0;

        // Update function for proximity-based effects
        const updateCards = () => {
            const rotY = gsap.getProperty(ring, 'rotationY');
            gsap.utils.toArray('.img').forEach((img, i) => {
                const angle = i * 90; // for 4 cards
                const relativeRotation = (rotY + angle) % 360;
                const dist = Math.abs(gsap.utils.wrap(-180, 180, relativeRotation + 180));

                // Keep opacity high but scale up center card
                const proximity = 1 - Math.min(dist / 90, 1);
                gsap.set(img, {
                    opacity: 0.8 + (proximity * 0.2), // Minimum 80% opacity
                    scale: 0.9 + (proximity * 0.15),
                    zIndex: Math.round(proximity * 10) // Bring centered card to front
                });
            });
        };

        gsap.timeline({ onUpdate: updateCards })
            .set(ring, { rotationY: 180, rotationX: -10 })
            .set('.img', {
                rotateY: (i) => i * -90,
                transformOrigin: '50% 50% 650px',
                z: -650,
                backfaceVisibility: 'hidden'
            })
            .from('.img', {
                duration: 1.5,
                y: 200,
                opacity: 0,
                stagger: 0.1,
                ease: 'expo',
                onComplete: updateCards
            });

        // Use a virtual target for the draggable to avoid moving the wrapper itself
        const dragInstance = Draggable.create(document.createElement('div'), {
            trigger: wrapper,
            type: 'x',
            onDragStart: (e) => {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                xPos = Math.round(clientX);
            },
            onDrag: (e) => {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                gsap.to(ring, {
                    rotationY: '-=' + ((Math.round(clientX) - xPos) % 360),
                    onUpdate: updateCards
                });
                xPos = Math.round(clientX);
            }
        });

        return () => {
            if (dragInstance && dragInstance[0]) dragInstance[0].kill();
        };
    }, []);

    // GSAP Parallax Effect for Glow Layers
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!window.matchMedia('(hover: hover)').matches) return; // Only apply on hoverable devices
            if (!glow1Ref.current || !glow2Ref.current) return;

            const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
            const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1

            gsap.to(glow1Ref.current, {
                x: x * 20,
                y: y * 20,
                duration: 1.5,
                ease: 'power2.out',
            });
            gsap.to(glow2Ref.current, {
                x: x * -30,
                y: y * -30,
                duration: 1.5,
                ease: 'power2.out',
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (!titleRef.current) return;
        const titleChars = titleRef.current.querySelectorAll('.title-char');
        const tl = gsap.timeline({ delay: 0.5 });
        tl.fromTo(
            titleChars,
            { willChange: 'opacity, filter', opacity: 0, filter: 'blur(20px)' },
            {
                ease: 'power2.inOut',
                opacity: 1,
                filter: 'blur(0px)',
                stagger: { each: 0.05, from: 'random' },
                duration: 1.2
            }
        );

        if (subtitleRef.current) {
            const subtitleWords = subtitleRef.current.querySelectorAll('.subtitle-word');
            tl.fromTo(
                subtitleWords,
                { opacity: 0, y: 20, filter: 'blur(10px)' },
                {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    duration: 1,
                    stagger: 0.05,
                    ease: 'power3.out',
                },
                "-=0.6"
            );
        }

        return () => tl.kill();
    }, []);

    const modeCards = [
        {
            icon: BriefcaseIcon, badge: 'Live', title: 'Recruiter Interview',
            description: 'Live video interview with anti-cheating detection',
            features: ['Real-time video calling', 'Collaborative code editor', 'AI-powered proctoring', 'Automated reports'],
        },
        {
            icon: DumbbellIcon, badge: 'Practice', title: 'Practice Interview',
            description: 'Practice with AI interviewer and instant feedback',
            features: ['AI interviewer', 'Instant feedback', 'Progress tracking', 'Unlimited attempts'],
        },
        {
            icon: CodeIcon, badge: 'DSA', badgeAccent: true, title: 'Coding Practice',
            description: 'LeetCode-style problems with AI-powered hints',
            features: ['11+ curated problems', 'Multiple languages', 'AI-generated problems', 'Smart hints'],
        },
        {
            icon: RobotIcon, badge: 'AI', badgeAccent: true, title: 'AI Interviewer',
            description: 'Get interviewed by AI with comprehensive evaluation',
            features: ['Role-based questions', 'Voice or text answers', 'Multi-metric scoring', 'Hiring recommendations'],
        },
    ];

    const featureCards = [
        { icon: VideoIcon, title: 'Video Conferencing', description: 'HD video and audio with WebRTC technology for seamless communication' },
        { icon: CodeIcon, title: 'Live Code Editor', description: 'Collaborative coding with syntax highlighting and real-time sync' },
        { icon: ShieldIcon, title: 'AI Proctoring', description: 'Advanced cheating detection with face tracking and tab monitoring' },
        { icon: BrainIcon, title: 'AI Assistant', description: 'Automated feedback, code evaluation, and performance insights' },
    ];

    return (
        <div className="home">
            <Navbar />
            <GridBackground />
            <FloatingParticles />

            {/* ─── Hero Section ─── */}
            <motion.section className="hero" style={{ opacity: heroOpacity, scale: heroScale }}>
                <div className="parallax-glow glow-layer-1" ref={glow1Ref} />
                <div className="parallax-glow glow-layer-2" ref={glow2Ref} />
                <div className="hero-glow" />
                <div className="container hero-container">

                    {/* Badge */}
                    <motion.div
                        className="hero-badge"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <SparklesIcon size={14} />
                        <span>AI-Powered Platform</span>
                    </motion.div>

                    {/* Title – GSAP blur-stagger */}
                    <h1 className="hero-title" ref={titleRef}>
                        <span className="title-line title-line-main">
                            {'Next-Gen Interview'.split('').map((char, i) => (
                                <span key={i} className="title-char">
                                    {char === ' ' ? '\u00A0' : char}
                                </span>
                            ))}
                        </span>
                        <br />
                        <span className="title-line title-line-accent">
                            {'Platform'.split('').map((char, i) => (
                                <span key={i} className="title-char">
                                    {char === ' ' ? '\u00A0' : char}
                                </span>
                            ))}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <motion.p
                        className="hero-subtitle"
                        ref={subtitleRef}
                        initial={{ opacity: 1 }} // Start at 1, let GSAP words handle inner hidden state
                    >
                        {'Conduct AI-powered interviews with live coding and smart analytics'.split(' ').map((word, i) => (
                            <span key={i} className="subtitle-word" style={{ display: 'inline-block', opacity: 0 }}>
                                {word}&nbsp;
                            </span>
                        ))}
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        className="hero-cta"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 1.1 }}
                    >
                        <motion.button
                            className="btn btn-primary btn-large"
                            onClick={() => navigate('/register')}
                            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255,255,255,0.15)' }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Get Started <ArrowRightIcon size={18} />
                        </motion.button>
                    </motion.div>

                    <ScrollIndicator />
                </div>
            </motion.section>

            {/* ─── Stats Section ─── */}
            <section className="stats-section" id="stats">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <div className="section-badge"><BarChartIcon size={14} /> Platform Impact</div>
                            <h2>Trusted by Hiring Teams Everywhere</h2>
                            <p>Delivering measurable results in the hiring process</p>
                        </div>
                    </ScrollReveal>
                    <div className="stats-grid">
                        <StatCard icon={UsersIcon} value={10000} suffix="+" label="Interviews Conducted" delay={0.1} />
                        <StatCard icon={GlobeIcon} value={50} suffix="+" label="Companies Onboarded" delay={0.2} />
                        <StatCard icon={ShieldIcon} value={99} suffix="%" label="Proctoring Accuracy" delay={0.3} />
                        <StatCard icon={ZapIcon} value={85} suffix="%" label="Faster Hiring Cycles" delay={0.4} />
                    </div>
                </div>
            </section>

            {/* ─── Mode Cards Section ─── */}
            <section className="modes-section" id="modes">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <BubbleText text="Choose Your Interview Mode" />
                        </div>
                    </ScrollReveal>
                    <div className="modes-3d-wrapper" ref={wrapperRef}>
                        <div className="ring" ref={ringRef}>
                            {modeCards.map((card, i) => (
                                <div className="img" key={i}>
                                    <ModeCard {...card} delay={0} alwaysVisible={true} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Features Section ─── */}
            <section className="features-section" id="features">
                <div className="container">
                    <ScrollReveal>
                        <div className="section-header">
                            <div className="section-badge"><SparklesIcon size={14} /> Features</div>
                            <h2><RevealText text="Platform Features" /></h2>
                            <p>Everything you need for successful interviews</p>
                        </div>
                    </ScrollReveal>
                    <div className="features-grid">
                        {featureCards.map((card, i) => (
                            <FeatureCard key={i} {...card} delay={i * 0.12} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA Banner ─── */}
            <section className="cta-banner-section">
                <div className="container">
                    <ScrollReveal>
                        <div className="cta-banner">
                            <div className="cta-banner-glow" />
                            <h2>Ready to Transform Your Hiring?</h2>
                            <p>Join thousands of teams already using HireSpec to find the best talent.</p>
                            <motion.button
                                className="btn btn-primary btn-large"
                                onClick={() => navigate('/register')}
                                whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(255,255,255,0.12)' }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Start for Free <ArrowRightIcon size={18} />
                            </motion.button>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="footer">
                <div className="container">
                    <ScrollReveal>
                        <div className="footer-content">
                            <div className="footer-brand">
                                <TargetIcon size={24} />
                                <span>HireSpec</span>
                            </div>
                            <p className="footer-text">AI-powered interview platform for modern hiring</p>
                            <div className="footer-links">
                                <a href="#features">Features</a>
                                <a href="#modes">Solutions</a>
                                <a href="#stats">Impact</a>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </footer>
        </div>
    );
};

export default Home;