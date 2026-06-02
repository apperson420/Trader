# BTC Sovereign v1.2 - Portfolio Optimization Engine

import numpy as np
import pandas as pd

class PortfolioOptimizer:
    def __init__(self, returns):
        self.returns = pd.DataFrame(returns)
        self.mean_returns = self.returns.mean()
        self.cov_matrix = self.returns.cov()

    def optimize_markowitz(self, target_return=None):
        n = len(self.mean_returns)
        weights = np.ones(n) / n
        return {'weights': weights.tolist(), 'expected_return': float(self.mean_returns.mean())}

    def risk_parity(self):
        vol = np.sqrt(np.diag(self.cov_matrix))
        weights = 1 / vol
        weights /= weights.sum()
        return {'weights': weights.tolist()}

    def get_efficient_frontier(self, num_portfolios=5000):
        results = []
        for _ in range(num_portfolios):
            weights = np.random.random(len(self.mean_returns))
            weights /= weights.sum()
            ret = np.dot(weights, self.mean_returns)
            vol = np.sqrt(np.dot(weights.T, np.dot(self.cov_matrix, weights)))
            results.append({'return': ret, 'volatility': vol, 'weights': weights.tolist()})
        return results