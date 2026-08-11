import { motion } from "framer-motion";

const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

const COMPANIONS = [
    { name: 'Sabia', id: '#550369', age: 22, height: "5'4\"", city: 'Dhaka', img: 'https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=300&q=80', demo: true },
    { name: 'Fatiha', id: '#550983', age: 24, height: "5'6\"", city: 'Sylhet', img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&q=80', demo: true },
    { name: 'Samina', id: '#550120', age: 23, height: "5'5\"", city: 'Dhaka', img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&q=80', demo: false },
    { name: 'Nisha', id: '#550882', age: 21, height: "5'3\"", city: 'Chittagong', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80', demo: false },
    { name: 'Riya', id: '#550294', age: 25, height: "5'7\"", city: 'Dhaka', img: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80', demo: false },
];

export function ModelsPage() {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            style={{ minHeight: '100%', background: 'var(--bg-main)', padding: '16px' }}
        >
            {/* Top Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1.1rem', letterSpacing: '0.2em', color: 'var(--blue-vivid)', fontWeight: 400,
                }}>
                    SOCIAFY
                </span>
                <span style={{
                    fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                    background: 'var(--blue-glow)', border: '1px solid var(--border-subtle)',
                    padding: '4px 10px', borderRadius: '6px',
                }}>
                    ◈ COMPANIONS
                </span>
            </div>

            {/* Title */}
            <motion.div variants={fadeUp} style={{ marginBottom: '20px' }}>
                <h2 style={{
                    fontFamily: "'Inter', sans-serif", fontWeight: 700,
                    fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '4px',
                }}>
                    Elite Directory
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: "'Inter', sans-serif" }}>
                    Select a profile to initiate booking protocols.
                </p>
            </motion.div>

            {/* Grid of Profiles */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
            }}>
                {COMPANIONS.map(p => (
                    <motion.div
                        key={p.id}
                        variants={fadeUp}
                        style={{
                            borderRadius: '12px', overflow: 'hidden',
                            border: '1.5px solid var(--border-subtle)',
                            position: 'relative', cursor: 'pointer',
                            background: 'var(--bg-card)',
                        }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <img src={p.img} alt={p.name} style={{
                            width: '100%', height: '170px', objectFit: 'cover', display: 'block',
                            filter: p.demo ? 'none' : 'blur(8px)',
                        }} />
                        
                        {/* Demo/Premium badge */}
                        <span style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: p.demo ? 'var(--bg-overlay)' : 'var(--gold-mid)',
                            color: p.demo ? 'var(--text-secondary)' : '#000',
                            fontSize: '0.45rem', letterSpacing: '0.15em',
                            textTransform: 'uppercase', padding: '3px 8px',
                            borderRadius: '4px', fontFamily: "'Inter', sans-serif", fontWeight: 700,
                        }}>
                            {p.demo ? 'DEMO' : 'PREMIUM'}
                        </span>

                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'linear-gradient(transparent, var(--bg-nav))',
                            padding: '20px 10px 10px',
                        }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: '2px' }}>{p.name}</p>
                            <p style={{ color: 'var(--blue-vivid)', fontSize: '0.55rem', fontFamily: "'Inter', sans-serif", marginBottom: '4px' }}>{p.id}</p>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                <span>{p.age} Yrs</span>
                                <span>•</span>
                                <span>{p.city}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
