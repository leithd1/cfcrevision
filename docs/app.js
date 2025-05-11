document.addEventListener('DOMContentLoaded', function() {
  // Variables globales
  let flashcards = [];
  let currentFlashcardIndex = 0;
  let currentBoxNumber = 1;
  let currentDeck = '';
  
  // Intervalles de révision en heures (1, 3, 9, 27, 81)
  const reviewIntervals = [1, 3, 9, 27, 81];
  
  // Éléments du DOM
  const accordionBtn = document.querySelector('.accordion-btn');
  const accordionContent = document.querySelector('.accordion-content');
  const boxes = document.querySelectorAll('.box');
  const boxCounters = document.querySelectorAll('.box-counter');
  const boxNextReviews = document.querySelectorAll('.box-next-review');
  const flashcardContainer = document.getElementById('flashcard-container');
  const questionContent = document.getElementById('question-content');
  const answerContent = document.getElementById('answer-content');
  const lastReviewed = document.getElementById('last-reviewed');
  const showAnswerBtn = document.getElementById('show-answer-btn');
  const answerSection = document.getElementById('answer-section');
  const wrongAnswerBtn = document.getElementById('wrong-answer');
  const rightAnswerBtn = document.getElementById('right-answer');
  const resetBtn = document.getElementById('reset-btn');
  const startBtn = document.getElementById('start-btn');
  const deckSelector = document.getElementById('deck-selector');
  const cardsListContainer = document.getElementById('cards-list-container');
  const cardsList = document.getElementById('cards-list');
  const cardsListTitle = document.getElementById('cards-list-title');
  
  // Charger les flashcards
  function loadFlashcards(deckFile) {
      fetch(deckFile)
          .then(response => response.text())
          .then(data => {
              const lines = data.split('\n').filter(line => line.trim() !== '');
              const headers = lines[0].split(',').map(h => h.trim());
              
              flashcards = lines.slice(1)
                  .filter(line => line.trim() !== '')
                  .map(line => {
                      const values = parseCSVLine(line);
                      const card = {};
                      headers.forEach((header, index) => {
                          card[header] = values[index] ? values[index].trim() : '';
                      });
                      
                      // Traitement spécial pour les champs
                      return {
                          question: card.question_content,
                          answer: card.answer_content,
                          box: parseInt(card.box_number) || 1,
                          lastReview: card.last_reviewed ? new Date(card.last_reviewed).getTime() || Date.now() : Date.now()
                      };
                  });
              
              // Charger depuis localStorage si disponible
              const savedFlashcards = localStorage.getItem('leitnerFlashcards');
              if (savedFlashcards) {
                  try {
                      const parsed = JSON.parse(savedFlashcards);
                      // Fusionner avec les flashcards chargées, en gardant les données de progression
                      flashcards = flashcards.map(card => {
                          const savedCard = parsed.find(c => c.question === card.question);
                          return savedCard ? {...card, ...savedCard} : card;
                      });
                  } catch (e) {
                      console.error('Erreur de lecture du localStorage', e);
                  }
              }
              
              updateBoxCounters();
              updateNextReviewTimes();
              hideCardsList();
              preloadImages();
          })
          .catch(error => console.error('Erreur:', error));
  }
  
  // Parser une ligne CSV en tenant compte des guillemets
  function parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
              inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
              values.push(current);
              current = '';
          } else {
              current += char;
          }
      }
      
      values.push(current);
      return values;
  }
  
  // Extraire le texte avant le | pour les questions/réponses avec images
  function extractText(content) {
      if (!content) return '';
      const parts = content.split('|');
      return parts[0].trim();
  }
  
  // Extraire le chemin de l'image pour les questions/réponses avec images
  function extractImagePath(content) {
      if (!content) return null;
      const parts = content.split('|');
      return parts.length > 1 ? parts[1].trim() : null;
  }
  
  // Précharger les images
  function preloadImages() {
      flashcards.forEach(card => {
          const questionImage = extractImagePath(card.question);
          if (questionImage) {
              new Image().src = questionImage;
          }
          
          const answerImage = extractImagePath(card.answer);
          if (answerImage) {
              new Image().src = answerImage;
          }
      });
  }
  

  document.querySelectorAll('.box').forEach(box => {
    box.addEventListener('click', function(event) {
        // Scroller jusqu'au conteneur des cartes
        const container = document.getElementById('cards-list-container');
        if (container) {
            container.classList.remove('hidden'); // Affiche le conteneur si nécessaire
            container.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll fluide
        }
        // Empêche toute autre action comme l'ouverture de la modale
        event.stopPropagation();
        event.preventDefault();
    });
});





  // Mettre à jour les compteurs et les temps de révision
  function updateBoxCounters() {
      boxes.forEach((box, index) => {
          const boxNumber = index + 1;
          const boxCards = flashcards.filter(card => card.box === boxNumber);
          const count = boxCards.length;
          
          boxCounters[index].textContent = `${count} carte(s)`;
          
          // Mettre à jour le prochain temps de révision pour la boîte
          if (count > 0) {
              const nextReview = getNextReviewTime(boxNumber);
              boxNextReviews[index].textContent = `Prochaine rev.: ${formatTime(nextReview)}`;
          } else {
              boxNextReviews[index].textContent = '';
          }
      });
  }
  
  // Calculer le prochain temps de révision pour une boîte
  function getNextReviewTime(boxNumber) {
      const boxCards = flashcards.filter(card => card.box === boxNumber);
      if (boxCards.length === 0) return null;
      
      // Trouver la carte avec le prochain temps de révision
      return boxCards.reduce((min, card) => {
          const cardNextReview = card.lastReview + reviewIntervals[card.box - 1] * 3600 * 1000;
          return Math.min(min, cardNextReview);
      }, Infinity);
  }
  
  // Formater le temps
  function formatTime(timestamp) {
      if (!timestamp) return '';
      
      const now = Date.now();
      const date = new Date(timestamp);
      
      if (timestamp <= now) {
          return 'Maintenant';
      }
      
      // Si c'est aujourd'hui, afficher seulement l'heure
      const today = new Date();
      if (date.getDate() === today.getDate() && 
          date.getMonth() === today.getMonth() && 
          date.getFullYear() === today.getFullYear()) {
          return date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
      }
      
      // Sinon, afficher date et heure
      return date.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute:'2-digit'
      });
  }
  
  // Afficher la liste des cartes
  function showCardsList(boxNumber) {
      const boxCards = flashcards.filter(card => card.box === boxNumber);
      cardsList.innerHTML = '';
      
      if (boxCards.length === 0) {
          cardsList.innerHTML = '<p class="text-gray-500">Aucune carte</p>';
      } else {
          boxCards.forEach((card, index) => {
              const cardElement = document.createElement('div');
              cardElement.className = 'bg-gray-50 p-3 rounded cursor-pointer hover:bg-gray-100 border-l-4 border-gray-500';
              
              // Afficher le texte de la question ou "Image" si c'est une image
              const questionText = extractText(card.question);
              cardElement.innerHTML = `
                  <div>${questionText || `Image ${index + 1}`}</div>
                  <div class="text-xs text-gray-500 mt-1">Rev.: ${formatTime(card.lastReview + reviewIntervals[card.box - 1] * 3600 * 1000)}</div>
              `;
              
              cardElement.addEventListener('click', () => showFlashcard(boxNumber, index));
              cardsList.appendChild(cardElement);
          });
      }
      
      cardsListTitle.textContent = `Cartes de la boîte ${boxNumber}`;
      cardsListContainer.classList.remove('hidden');
  }
  
  // Cacher la liste
  function hideCardsList() {
      cardsListContainer.classList.add('hidden');
  }
  
  // Afficher une flashcard
  function showFlashcard(boxNumber, cardIndex) {
      currentBoxNumber = boxNumber;
      const boxCards = flashcards.filter(card => card.box === boxNumber);
      currentFlashcardIndex = flashcards.indexOf(boxCards[cardIndex]);
      const card = flashcards[currentFlashcardIndex];
      
      // Effacer le contenu précédent
      questionContent.innerHTML = '';
      answerContent.innerHTML = '';
      
      // Afficher la question
      const questionText = extractText(card.question);
      const questionImage = extractImagePath(card.question);
      
      if (questionText) {
          const textElement = document.createElement('div');
          textElement.textContent = questionText;
          questionContent.appendChild(textElement);
      }
      
      // if (questionImage) {
      //     const imgElement = document.createElement('img');
      //     imgElement.src = questionImage;
      //     imgElement.alt = 'Image question';
      //     //imgElement.className = 'w-full h-60 object-contain mx-auto my-3 rounded-lg border border-gray-200';
      //     imgElement.className = 'max-w-full h-auto mx-auto my-3 rounded';
      //     questionContent.appendChild(imgElement);
      // }
      if (questionImage) {
        const imgElement = document.createElement('img');
        imgElement.src = questionImage;
        imgElement.alt = 'Image question';
        
        // Classes Tailwind de base
        imgElement.className = 'mx-auto my-3 max-w-full max-h-[300px] w-auto h-auto object-scale-down';
        
        // Préchargement pour détection taille
        const tempImg = new Image();
        tempImg.src = questionImage;
        tempImg.onload = function() {
            // Pour les très petites images (<150px)
            if (tempImg.naturalWidth < 150 && tempImg.naturalHeight < 150) {
                imgElement.classList.remove('max-w-full', 'max-h-[300px]');
                imgElement.classList.add('max-w-none', 'max-h-none');
            }
            // Pour les images moyennes (entre 150px et 400px)
            else if (tempImg.naturalWidth < 400 && tempImg.naturalHeight < 400) {
                imgElement.classList.remove('max-h-[300px]');
                imgElement.classList.add('max-h-none');
            }
        };

        imgElement.onerror = () => {
            imgElement.alt = 'Image non disponible';
            imgElement.className = 'mx-auto my-3 bg-gray-200 w-full h-[150px] flex items-center justify-center text-gray-500';
            imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 150"><rect width="100%" height="100%" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Image non disponible</text></svg>';
        };
        
        questionContent.appendChild(imgElement);
    }
    
      // Préparer la réponse (masquée)
      const answerText = extractText(card.answer);
      const answerImage = extractImagePath(card.answer);
      
      if (answerText) {
          const textElement = document.createElement('div');
          textElement.textContent = answerText;
          answerContent.appendChild(textElement);
      }
      
      if (answerImage) {
        const imgElement = document.createElement('img');
        imgElement.src = answerImage;
        imgElement.alt = 'Image réponse';
        imgElement.className = 'mx-auto my-3 max-w-full max-h-[380px] w-auto h-auto object-scale-down';
        
        const tempImg = new Image();
        tempImg.src = answerImage;
        tempImg.onload = function() {
            if (tempImg.naturalWidth < 150 && tempImg.naturalHeight < 150) {
                imgElement.classList.remove('max-w-full', 'max-h-[350px]');
                imgElement.classList.add('max-w-none', 'max-h-none');
            }
            else if (tempImg.naturalWidth < 400 && tempImg.naturalHeight < 400) {
                imgElement.classList.remove('max-h-[350px]');
                imgElement.classList.add('max-h-none');
            }
        };
        
        imgElement.onerror = () => {
            imgElement.alt = 'Image non disponible';
            imgElement.className = 'mx-auto my-3 bg-gray-200 w-full h-[150px] flex items-center justify-center text-gray-500';
            imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 300 150"><rect width="100%" height="100%" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Image non disponible</text></svg>';
        };
        
        answerContent.appendChild(imgElement);
    }
      
      // Mettre à jour la date
      lastReviewed.textContent = `Dernière révision: ${new Date(card.lastReview).toLocaleString('fr-FR')}`;
      
      // Réinitialiser l'affichage
      answerSection.classList.add('hidden');
      showAnswerBtn.style.display = 'block';
      flashcardContainer.classList.remove('hidden');
      hideCardsList();
  }
  
  // Gérer la réponse
  function handleAnswer(isCorrect) {
      const card = flashcards[currentFlashcardIndex];
      card.lastReview = Date.now();
      card.box = isCorrect ? Math.min(card.box + 1, 5) : 1;
      
      // Sauvegarder dans localStorage
      saveFlashcards();
      
      updateBoxCounters();
      updateNextReviewTimes();
      flashcardContainer.classList.add('hidden');
  }
  
  // Mettre à jour les temps de révision
  function updateNextReviewTimes() {
      boxes.forEach((box, index) => {
          const boxNumber = index + 1;
          const nextReview = getNextReviewTime(boxNumber);
          boxNextReviews[index].textContent = nextReview 
              ? `Prochaine rev.: ${formatTime(nextReview)}` 
              : '';
      });
  }
  
  // Sauvegarder les flashcards
  function saveFlashcards() {
      try {
          localStorage.setItem('leitnerFlashcards', JSON.stringify(flashcards));
      } catch (e) {
          console.error('Erreur de sauvegarde dans localStorage', e);
      }
  }
  
  // Initialiser l'app
  function initApp() {
      if (currentDeck) {
          loadFlashcards(currentDeck);
          startBtn.textContent = 'Changer de jeu';
      }
  }
  
  // Événements
  accordionBtn.addEventListener('click', () => {
      accordionContent.classList.toggle('max-h-0');
      accordionContent.classList.toggle('max-h-[500px]');
      accordionBtn.textContent = accordionContent.classList.contains('max-h-[500px]') 
          ? 'Mode d\'emploi ▲' 
          : 'Mode d\'emploi ▼';
  });
  
  boxes.forEach(box => {
      box.addEventListener('click', () => {
          const boxNumber = parseInt(box.dataset.boxNumber);
          showCardsList(boxNumber);
      });
  });
  
  showAnswerBtn.addEventListener('click', () => {
      answerSection.classList.remove('hidden');
      showAnswerBtn.style.display = 'none';
  });
  
  wrongAnswerBtn.addEventListener('click', () => handleAnswer(false));
  rightAnswerBtn.addEventListener('click', () => handleAnswer(true));
  
  resetBtn.addEventListener('click', () => {
      if (confirm('Réinitialiser toutes les cartes à la boîte 1?')) {
          flashcards.forEach(card => {
              card.box = 1;
              card.lastReview = Date.now();
          });
          saveFlashcards();
          updateBoxCounters();
          updateNextReviewTimes();
          hideCardsList();
      }
  });
  
  startBtn.addEventListener('click', () => {
      if (deckSelector.value) {
          currentDeck = deckSelector.value;
          initApp();
      } else {
          alert('Sélectionnez un jeu de flashcards');
      }
  });
  
  deckSelector.addEventListener('change', function() {
      if (this.value) {
          currentDeck = this.value;
          startBtn.disabled = false;
      }
  });
  
  // Initialisation
  hideCardsList();
  flashcardContainer.classList.add('hidden');
  
  // Vérifier périodiquement les temps de révision
  setInterval(updateNextReviewTimes, 60000); // Toutes les minutes
});