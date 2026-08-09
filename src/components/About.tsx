
import React from 'react';
import ProfileCard from './ProfileCard';
import AnimatedContent from './AnimatedContent';

// Image imports
import pfpImage from './pfp.jpg'; 
import pfp2Image from './pfp2.jpg'; 

const About: React.FC = () => {
  
  // 1. Email function
  const handleEmail = () => {
    window.location.href = "mailto:thejollyroachman@gmail.com";
  };

  // 2. Instagram function
  const handleInsta = () => {
    window.open("https://www.instagram.com/rat_splatttt/", "_blank");
  };

  return (
    <div className="w-full min-h-[85vh] flex flex-col portrait:flex-col landscape:flex-row items-center justify-center gap-12 px-4 md:px-12 max-w-7xl mx-auto py-8">
      
      {/* LEFT COLUMN: HOLOGRAPHIC CARD */}
      <div className="flex justify-center items-center w-full lg:w-auto">
        <ProfileCard 
          name="Cookaracha"
          handle="sometemplate"
          title="ai addict"
          status="drinking white bull"
          avatarUrl={pfpImage} 
          miniAvatarUrl={pfp2Image} // Modified to use pfp2.jpg strictly for the mini-avatar in the bottom left
          iconUrl={pfp2Image} 
          contactText="Email"
          onContactClick={handleEmail}
          instaText="Insta"
          onInstaClick={handleInsta}
        />
      </div>

      {/* RIGHT COLUMN: TEXT CONTENT */}
      <div className="flex flex-col justify-center items-center landscape:items-start text-center landscape:text-left space-y-6 w-full max-w-lg">
        <AnimatedContent distance={40} delay={0.2}>
          <div className="space-y-2">
            <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-rose-400 font-['Lexend'] uppercase">
              more info
            </h2>
            <p className="text-[12px] uppercase tracking-[0.6em] text-neutral-500 font-medium">
              COMERA GO BEEP BOOP
            </p>
          </div>
        </AnimatedContent>

        <AnimatedContent distance={40} delay={0.4}>
          <div className="max-w-md space-y-4 text-neutral-400 font-light leading-relaxed tracking-wide text-base md:text-lg">
            <p>
              i think i like editing more than taking pictures me use an eos r100 and the adobe indigo app on a 14 pro mostly
            </p>
          </div>
        </AnimatedContent>

        <AnimatedContent distance={40} delay={0.6}>
          <div className="pt-8 border-t border-white/5 flex flex-row justify-center landscape:justify-start gap-12 text-sm text-zinc-500 w-full">
            <div>
              <span className="block text-rose-400 font-semibold uppercase tracking-widest text-[11px]">Location</span>
              <span className="text-zinc-300">Melbourne, Victoria</span>
            </div>
            <div>
              <span className="block text-rose-400 font-semibold uppercase tracking-widest text-[11px]">Focus</span>
              <span className="text-zinc-300">idk</span>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
};

export default About;
