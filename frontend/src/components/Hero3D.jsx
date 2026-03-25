import * as THREE from 'three';
import { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, Float, Environment, ContactShadows } from '@react-three/drei';
import { motion } from 'framer-motion';

// Pre-define some colors/urls (using placeholders for demo)
const IMAGES = [
    "https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?w=500&q=80",
    "https://images.unsplash.com/photo-1549480017-d76466a4b7e8?w=500&q=80",
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&q=80",
];

function Polaroid({ url, position = [0, 0, 0], rotation = [0, 0, 0], factor = 1 }) {
    const mesh = useRef();
    const texture = useTexture(url);
    const [hovered, setHovered] = useState(false);

    // Parallax Logic
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const mouse = state.mouse;

        // Smooth dampening for mouse interaction
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, rotation[0] + mouse.y * 0.1, 0.1);
        mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, rotation[1] + mouse.x * 0.1, 0.1);

        // Slight idle sway
        mesh.current.position.y = position[1] + Math.sin(t * factor) * 0.1;
    });

    return (
        <motion.group
            position={position}
            rotation={rotation}
            ref={mesh}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 0.3 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
        >
            {/* Photo Frame */}
            <mesh
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
                scale={hovered ? 1.05 : 1}
            >
                <boxGeometry args={[3, 3.5, 0.05]} />
                <meshStandardMaterial color="#fdfbf7" roughness={0.1} metalness={0.05} />
            </mesh>

            {/* Image Plane */}
            <mesh position={[0, 0.25, 0.03]}>
                <planeGeometry args={[2.6, 2.6]} />
                <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
        </motion.group>
    );
}

function Scene() {
    const { viewport } = useThree();

    return (
        <>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#aaa" />

        <Float
            speed={2}
            rotationIntensity={0.5}
            floatIntensity={0.5}
            floatingRange={[-0.2, 0.2]}
        >
            <Polaroid
                url={IMAGES[0]}
                position={[viewport.width < 8 ? -1.5 : -3, 0.5, 0]}
                rotation={[0, 0.2, -0.1]}
                factor={0.8}
            />
            <Polaroid
                url={IMAGES[1]}
                position={[0, 0, 1]}
                rotation={[0, 0, 0.05]}
                factor={1.2}
            />
            <Polaroid
                url={IMAGES[2]}
                position={[viewport.width < 8 ? 1.5 : 3, -0.5, -0.5]}
                rotation={[0, -0.2, 0.1]}
                factor={1}
            />
        </Float>

            <ContactShadows position={[0, -4, 0]} opacity={0.4} scale={20} blur={2} far={4} />
            <Environment preset="city" />
        </>
    );
}

export default function Hero3D() {
    return (
        <div className="absolute inset-0 z-0 h-[80vh] w-full pointer-events-auto">
            <Canvas camera={{ position: [0, 0, 8], fov: 40 }} dpr={[1, 2]}>
                <Scene />
            </Canvas>
            {/* Gradient Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent pointer-events-none" />
        </div>
    );
}
