document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const findArbBtn = document.getElementById('findArbBtn');
    const resultsDiv = document.getElementById('results');
  
    // Retrieve API key and arbitrage opportunities from Chrome storage
    chrome.storage.local.get(['apiKey', 'arbitrageOpportunities'], (result) => {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
      if (result.arbitrageOpportunities) {
        displayResults(result.arbitrageOpportunities);
      }
    });
  
    findArbBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value;
      if (!apiKey) {
        alert('Please enter your API key');
        return;
      }
  
      // Save the API key to Chrome storage
      chrome.storage.local.set({ apiKey: apiKey });
  
      const SPORT = 'upcoming';
      const REGIONS = 'uk,us,eu,au';
      const MARKETS = 'h2h,spreads,totals';
      const ODDS_FORMAT = 'decimal';
      const DATE_FORMAT = 'iso';
  
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds?api_key=${apiKey}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}&dateFormat=${DATE_FORMAT}`;
  
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
  
        const oddsData = await response.json();
        const arbitrageOpportunities = findArbitrageBets(oddsData);
  
        // Save arbitrage opportunities to Chrome storage
        chrome.storage.local.set({ arbitrageOpportunities: arbitrageOpportunities });
  
        displayResults(arbitrageOpportunities);
  
        const remainingRequests = response.headers.get('x-requests-remaining');
        const usedRequests = response.headers.get('x-requests-used');
        alert(`Remaining requests: ${remainingRequests}, Used requests: ${usedRequests}`);
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to fetch data');
      }
    });
  });
  
  function findArbitrageBets(oddsData) {
    const opportunities = [];
    oddsData.forEach(event => {
      const odds = event.bookmakers.flatMap(bookmaker => bookmaker.markets[0].outcomes.map(outcome => ({
        team: outcome.name,
        odds: outcome.price,
        bookmaker: bookmaker.title
      })));
      
      const bestOdds = {};
      odds.forEach(odd => {
        if (!bestOdds[odd.team] || bestOdds[odd.team].odds < odd.odds) {
          bestOdds[odd.team] = odd;
        }
      });
  
      const teams = Object.keys(bestOdds);
      if (teams.length === 2) {
        const impliedProbability = 1 / bestOdds[teams[0]].odds + 1 / bestOdds[teams[1]].odds;
        if (impliedProbability < 1) {
          const betAmount = 100;  // Example total bet amount
          const { bet1, bet2, profit } = calculateBetsAndProfit(betAmount, bestOdds[teams[0]].odds, bestOdds[teams[1]].odds);
          opportunities.push({
            team1: bestOdds[teams[0]],
            team2: bestOdds[teams[1]],
            impliedProbability,
            bet1,
            bet2,
            profit
          });
        }
      }
    });
  
    return opportunities;
  }
  
  function calculateBetsAndProfit(totalBet, odds1, odds2) {
    const impliedProb1 = 1 / odds1;
    const impliedProb2 = 1 / odds2;
    const bet1 = (totalBet * impliedProb1) / (impliedProb1 + impliedProb2);
    const bet2 = totalBet - bet1;
    const profit = Math.min(bet1 * odds1, bet2 * odds2) - totalBet;
    return { bet1, bet2, profit };
  }
  
  function displayResults(arbitrageOpportunities) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
  
    if (arbitrageOpportunities.length === 0) {
      resultsDiv.innerHTML = '<p>No arbitrage opportunities found.</p>';
      return;
    }
  
    arbitrageOpportunities.forEach(opp => {
      const { team1, team2, impliedProbability, bet1, bet2, profit } = opp;
      const arbDiv = document.createElement('div');
      arbDiv.className = 'arbitrage';
      arbDiv.innerHTML = `
        <p><strong>Arbitrage Opportunity:</strong></p>
        <p>${team1.team} at ${team1.odds} (${team1.bookmaker})</p>
        <p>${team2.team} at ${team2.odds} (${team2.bookmaker})</p>
        <p>Implied Probability: ${(impliedProbability * 100).toFixed(2)}%</p>
        <p>Bet Amounts: $${bet1.toFixed(2)} on ${team1.team}, $${bet2.toFixed(2)} on ${team2.team}</p>
        <p>Profit: $${profit.toFixed(2)}</p>
      `;
      resultsDiv.appendChild(arbDiv);
    });
  }
  