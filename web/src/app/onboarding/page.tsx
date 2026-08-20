'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, Check, ChevronRight, Compass, Users, Heart, Target, ArrowRight, ShieldCheck
} from 'lucide-react';

const INTERESTS_LIST = [
  { id: 'tech', label: '💻 Tecnología', desc: 'IA, código y gadgets' },
  { id: 'gaming', label: '🎮 Gaming', desc: 'PC, consolas y eSports' },
  { id: 'music', label: '🎵 Música', desc: 'Géneros, playlists e instrumentos' },
  { id: 'anime', label: '⛩️ Anime & Manga', desc: 'Series, cultura y discusión' },
  { id: 'photo', label: '📷 Fotografía', desc: 'Capturas, edición y galerías' },
  { id: 'science', label: '🔬 Ciencia', desc: 'Universo, biología e investigación' },
  { id: 'travel', label: '✈️ Viajes', desc: 'Rutas, destinos y consejos' },
  { id: 'fitness', label: '💪 Fitness & Salud', desc: 'Deporte, nutrición y rutinas' },
  { id: 'art', label: '🎨 Arte & Diseño', desc: 'Ilustración, UI/UX y creación' },
  { id: 'code', label: '👨‍💻 Programación', desc: 'Java, React, WebSockets y backend' },
  { id: 'cinema', label: '🎬 Cine & Series', desc: 'Películas, críticas y debates' },
  { id: 'nature', label: '🌿 Naturaleza', desc: 'Ecología, senderismo y medio ambiente' },
];

const CIRCLES_LIST = [
  { name: 'Exploradores', members: '24 miembros', desc: 'Rutas de senderismo y actividades al aire libre.' },
  { name: 'Sostenibles', members: '18 miembros', desc: 'Proyectos ecológicos, huertos urbanos y reciclaje.' },
  { name: 'Vecinos Centro', members: '32 miembros', desc: 'Comunidad local, avisos y encuentros de barrio.' },
  { name: 'Café & Ideas', members: '21 miembros', desc: 'Reuniones informales para compartir proyectos creativos.' },
  { name: 'Lectores', members: '16 miembros', desc: 'Club de lectura, análisis de libros y recomendaciones.' },
  { name: 'Viajeros', members: '14 miembros', desc: 'Experiencias de viaje, mochileros y cultura.' },
];

const GOALS_LIST = [
  { id: 'learn', title: '🧠 Aprender cosas nuevas', desc: 'Descubrir contenido educativo y tutoriales' },
  { id: 'chat', title: '💬 Conversar y debatir', desc: 'Participar en hilos y salas de discusión en tiempo real' },
  { id: 'people', title: '👥 Conocer personas', desc: 'Conectar con miembros de tu misma ciudad o intereses' },
  { id: 'share', title: '✨ Compartir contenido', desc: 'Publicar tus proyectos, imágenes, notas de audio y estado' },
  { id: 'collab', title: '🤝 Colaborar en proyectos', desc: 'Unirte a iniciativas comunitarias y grupales' },
  { id: 'events', title: '📅 Encontrar eventos locales', desc: 'Asistir a meetups presenciales y eventos virtuales' },
];

export default function OnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<number>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('learn');
  const [submitting, setSubmitting] = useState(false);
  const [entryAllowed, setEntryAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setEntryAllowed(false);
      router.replace('/login');
      return;
    }
    if (sessionStorage.getItem('lifonk_onboarding_from_registration') !== '1') {
      setEntryAllowed(false);
      router.replace('/feed');
      return;
    }
    setEntryAllowed(true);
  }, [isLoading, user, router]);

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests(prev => prev.filter(i => i !== id));
    } else {
      setSelectedInterests(prev => [...prev, id]);
    }
  };

  const toggleCircle = (name: string) => {
    if (selectedCircles.includes(name)) {
      setSelectedCircles(prev => prev.filter(c => c !== name));
    } else {
      setSelectedCircles(prev => [...prev, name]);
    }
  };

  const handleFinishOnboarding = async () => {
    setSubmitting(true);
    try {
      await api.post('/profiles/onboarding', {
        interests: selectedInterests,
        circles: selectedCircles,
        socialGoal: selectedGoal
      });
      sessionStorage.removeItem('lifonk_onboarding_from_registration');
      router.replace('/feed');
    } catch (err) {
      console.error('No se pudo completar el onboarding:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (entryAllowed !== true) {
    return <div className="min-h-screen bg-[#f4f6f9] grid place-items-center text-sm text-slate-500">Validando registro…</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#1e293b] flex flex-col justify-between font-sans p-6">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-teal-800 flex items-center justify-center text-white font-black shadow-md shadow-teal-900/20">
            L
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-800 block">Lifonk</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block -mt-1">Bienvenida Personalizada</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s} 
              className={`h-2 rounded-full transition-all duration-300 ${
                step === s 
                  ? 'w-8 bg-teal-800' 
                  : step > s 
                    ? 'w-4 bg-teal-600' 
                    : 'w-4 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </header>

      {/* Main Form Box */}
      <main className="max-w-4xl mx-auto w-full my-8 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
          
          {/* Paso 1: Intereses */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <span className="text-xs font-bold uppercase text-teal-800 tracking-wider">Paso 1 de 4</span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">¿Qué temas te interesan? 💡</h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Selecciona al menos 3 temas para personalizar las recomendaciones en tu feed inicial.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTERESTS_LIST.map(item => {
                  const isSelected = selectedInterests.includes(item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => toggleInterest(item.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-teal-50 border-teal-800 shadow-sm' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-sm text-slate-800">{item.label}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">{item.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paso 2: Elección de Círculos */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <span className="text-xs font-bold uppercase text-teal-800 tracking-wider">Paso 2 de 4</span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">Únete a tus primeros Círculos ⭕</h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Los Círculos son espacios donde viven las conversaciones, personas y proyectos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CIRCLES_LIST.map(circle => {
                  const isSelected = selectedCircles.includes(circle.name);
                  return (
                    <div 
                      key={circle.name}
                      onClick={() => toggleCircle(circle.name)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-teal-50 border-teal-800 shadow-sm' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-slate-800">{circle.name}</h4>
                        <span className="text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-full inline-block">
                          {circle.members}
                        </span>
                        <p className="text-xs text-slate-500 font-medium">{circle.desc}</p>
                      </div>
                      <button className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isSelected ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isSelected ? 'Unido' : 'Unirme'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paso 3: Conexiones & Personas */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <span className="text-xs font-bold uppercase text-teal-800 tracking-wider">Paso 3 de 4</span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">Personas sugeridas en Lifonk 👥</h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Miembros activos compartiendo código, proyectos e ideas en tu comunidad.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { name: 'Alex Futurist', user: 'alex_futurist', bio: 'Diseñador UI/UX & Entusiasta de WebSockets' },
                  { name: 'Sophia Loren', user: 'sophia', bio: 'Creadora Digital & Cuidado del medio ambiente' },
                  { name: 'Marcos Dev', user: 'marcos_dev', bio: 'Desarrollador Backend Java & Spring Boot' },
                ].map((person, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-black flex items-center justify-center text-sm">
                        {person.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{person.name}</h4>
                        <span className="text-[10px] text-teal-800 font-bold">@{person.user}</span>
                        <p className="text-xs text-slate-500 font-medium">{person.bio}</p>
                      </div>
                    </div>
                    <button className="px-4 py-1.5 bg-teal-800 text-white text-xs font-bold rounded-xl hover:bg-teal-900 transition-all">
                      Conectar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paso 4: Personalización del Ritmo Social */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <span className="text-xs font-bold uppercase text-teal-800 tracking-wider">Paso 4 de 4</span>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">¿Qué buscas en Lifonk? 🎯</h2>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Esto configurará tu algoritmo social para mostrarte el contenido más valioso.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {GOALS_LIST.map(g => {
                  const isSelected = selectedGoal === g.id;
                  return (
                    <div 
                      key={g.id}
                      onClick={() => setSelectedGoal(g.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-teal-50 border-teal-800 shadow-sm' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <h4 className="font-bold text-sm text-slate-800">{g.title}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">{g.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            {step > 1 ? (
              <button 
                onClick={() => setStep(prev => prev - 1)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Anterior
              </button>
            ) : <div />}

            {step < 4 ? (
              <button 
                onClick={() => setStep(prev => prev + 1)}
                className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-800/20 flex items-center gap-1.5 transition-all"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={handleFinishOnboarding}
                disabled={submitting}
                className="px-8 py-3 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl shadow-lg shadow-teal-800/25 flex items-center gap-2 transition-all"
              >
                <span>{submitting ? 'Guardando...' : 'Comenzar en Lifonk'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 text-xs text-slate-400 font-medium">
        Lifonk &bull; Tu comunidad, tu gente, tus momentos.
      </footer>
    </div>
  );
}
