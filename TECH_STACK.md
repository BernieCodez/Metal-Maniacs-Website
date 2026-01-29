# Metal Maniacs Website - Tech Stack

## Overview
A professional static website for the Metal Maniacs FTC Robotics Team, built with modern web technologies for optimal performance and user experience.

---

## Frontend Technologies

### Core Technologies
- **HTML5** - Semantic markup for structure and accessibility
- **CSS3** - Modern styling with custom properties and animations
- **JavaScript (Vanilla)** - Interactive features and dynamic functionality

### Design & Styling
- **Google Fonts**
  - Orbitron (Display font for headers)
  - Montserrat (Body text for readability)
- **Font Awesome 6.5.1** - Icon library for visual elements
- **Custom CSS Grid & Flexbox** - Responsive layout system

### Design Principles
- Mobile-first responsive design
- Custom color scheme (Black #1a1a1a, Red #ff0000)
- Smooth scroll behavior
- Accessibility considerations

---

## Development Tools

### Version Control
- **Git** - Source code management
- **GitHub** - Repository hosting and collaboration
  - Repository: BernieCodez/Metal-Maniacs-Website
  - Branch: main

### Development Environment
- Any modern text editor/IDE (VS Code, Sublime Text, etc.)
- Live Server for local development
- Browser DevTools for debugging

---

## Hosting & Deployment Options

Since this is a static website with no server-side logic, you can deploy to:

### Recommended Platforms (Free Tier Available)
1. **GitHub Pages** ⭐ Recommended
   - Free hosting directly from your GitHub repository
   - Custom domain support
   - HTTPS enabled by default
   - Deploy: Settings → Pages → Select branch

2. **Netlify**
   - Continuous deployment from Git
   - Form handling (for contact forms)
   - Custom domains and HTTPS

3. **Vercel**
   - Fast global CDN
   - Instant deployments
   - Analytics available

4. **Cloudflare Pages**
   - Fast performance
   - Integrated with Cloudflare's global network

---

## File Structure
```
Metal-Maniacs-Website/
├── index.html           # Homepage (/)
├── about/
│   └── index.html       # About the team (/about/)
├── robot/
│   └── index.html       # Robot showcase (/robot/)
├── team/
│   └── index.html       # Team members (/team/)
├── outreach/
│   └── index.html       # Community outreach (/outreach/)
├── get-involved/
│   └── index.html       # Recruitment/contact (/get-involved/)
├── style.css            # Main stylesheet
├── favicon.svg          # Site favicon
├── robots.txt           # SEO configuration
├── sponsors/            # Sponsor assets
│   └── REV Robotics.avif
├── README.md            # Project overview
└── TECH_STACK.md        # This file
```

---

## Performance Features
- ✅ No external frameworks = Fast load times
- ✅ Optimized CSS with no bloat
- ✅ Minimal JavaScript for better performance
- ✅ Modern image formats (.avif)
- ✅ Fixed navigation for easy access
- ✅ Clean URLs (e.g., /about/ instead of /about.html)

---

## Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Future Enhancement Opportunities

### Optional Additions (if needed)
- **SEO Meta Tags** - Improve search engine visibility
- **Open Graph Tags** - Better social media sharing
- **JSON-LD Schema** - Structured data for search engines
- **Analytics** - Google Analytics or privacy-focused alternatives
- **Performance Monitoring** - Lighthouse CI
- **Image Optimization** - Compress images for faster loading
- **Progressive Web App (PWA)** - Offline functionality and installability

### Potential Libraries (if complexity grows)
- **AOS (Animate On Scroll)** - Scroll animations
- **Swiper.js** - Touch sliders/carousels
- **PhotoSwipe** - Image gallery lightbox

---

## Getting Started

### Local Development
```bash
# Clone the repository
git clone https://github.com/BernieCodez/Metal-Maniacs-Website.git

# Navigate to the directory
cd Metal-Maniacs-Website

# Open with live server or simply open index.html in a browser
```

### Deployment to GitHub Pages
```bash
# Push your changes to main branch
git add .
git commit -m "Update website"
git push origin main

# Enable GitHub Pages in repository settings:
# Settings → Pages → Source: Deploy from branch → Branch: main → Save
```

Your site will be available at: `https://berniecodez.github.io/Metal-Maniacs-Website/`

---

## Best Practices Implemented
✅ Semantic HTML5 markup  
✅ Responsive design (mobile-friendly)  
✅ Clean, maintainable CSS  
✅ Cross-browser compatibility  
✅ Fast load times (no heavy frameworks)  
✅ Consistent branding and color scheme  
✅ Professional typography  

---

## Maintenance Notes
- All styling is in `style.css` - keep it organized
- Use consistent naming conventions
- Test on multiple devices before deploying
- Optimize images before adding to repository
- Keep dependencies (Font Awesome, Google Fonts) up to date

---

## Contact & Support
For questions or contributions, contact the team through the website or GitHub repository.

**Go Metal Maniacs! 🤖⚙️**
