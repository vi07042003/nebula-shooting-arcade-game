import React from 'react';

const ShootingStars = () => {
  const stars = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 10}s`,
    duration: `${2 + Math.random() * 3}s`,
  }));

  const bgStars = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: `${Math.random() * 3}px`,
    duration: `${3 + Math.random() * 5}s`,
    delay: `${Math.random() * 5}s`,
  }));

  return (
    <>
      <div className="twinkling-stars">
        {bgStars.map((star) => (
          <div
            key={star.id}
            className="bg-star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              '--duration': star.duration,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>
      <div className="shooting-stars-container">
        {stars.map((star) => (
          <div
            key={star.id}
            className="star"
            style={{
              top: star.top,
              left: star.left,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default ShootingStars;
