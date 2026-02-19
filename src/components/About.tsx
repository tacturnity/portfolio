import React from 'react';
import ProfileCard from './ProfileCard';
import AnimatedContent from './AnimatedContent';

// 1. IMPORT YOUR IMAGE HERE
// Note: I added .jpg - if your file is a .png, change the extension below
import pfpImage from './pfp.jpg'; 

const About: React.FC = () => {
  const handleContact = () => {
    window.location.href = "mailto:hello@cookaracha.com";
  };

  return (
    <div className="w-full min-h-[80vh] grid grid-cols-1 md:grid-cols-2 items-center gap-12 px-4 md:px-12 max-w-7xl mx-auto">
      
      {/* LEFT COLUMN: HOLOGRAPHIC CARD */}
      <div className="flex justify-center items-center py-10">
        <ProfileCard 
          name="Cookaracha"
          handle="sometemplate"
          title="ai addict"
          status="drinking white bull"
          // 2. USE THE IMPORTED IMAGE VARIABLE HERE
          avatarUrl={pfpImage} 
          miniAvatarUrl={pfpImage}
          onContactClick={handleContact}
        />
      </div>

      {/* RIGHT COLUMN: TEXT CONTENT */}
      <div className="flex flex-col justify-center text-left space-y-10">
        <AnimatedContent distance={40} delay={0.2}>
          <div className="space-y-2">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-rose-400 font-['Lexend']">
              THE ARCHIVE
            </h2>
            {/* 3. UPDATED TEXT */}
            <p className="text-[12px] uppercase tracking-[0.6em] text-neutral-500 font-medium">
              comera go beep boop
            </p>
          </div>
        </AnimatedContent>

        <AnimatedContent distance={40} delay={0.4}>
          <div className="max-w-md space-y-6 text-neutral-400 font-light leading-relaxed tracking-wide text-lg">
            <p>
              i think i like editing more than taking pictures
            </p>
            <p>
              pretty fun doh
            </p>
          </div>
        </AnimatedContent>

        {/* 4. RESET STATS SECTION */}
        <AnimatedContent distance={40} delay={0.6}>
          <div className="flex gap-12 border-t border-white/5 pt-10">
            <div className="flex flex-col">
              <span className="text-rose-400 font-bold text-3xl">0</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">Prints</span>
            </div>
            <div className="flex flex-col">
              <span className="text-rose-400 font-bold text-3xl">0</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">Clicks</span>
            </div>
            <div className="flex flex-col">
              <span className="text-rose-400 font-bold text-3xl">0</span>
              <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-600">Awards</span>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
};

export default About;