import { render, screen } from '@testing-library/react';
import LoginPage from '../pages/login';

describe('Dashboard', () => {
  it('renders login form without synthetic data', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
  });
});
