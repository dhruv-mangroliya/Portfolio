import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Site from './site/Site.jsx';

// The admin dashboard is a separate chunk — public visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const Login = lazy(() => import('./admin/Login.jsx'));

const adminFallback = <div className="page-loader" aria-label="Loading" />;
const withSuspense = (el) => <Suspense fallback={adminFallback}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: '/', element: <Site /> },
  { path: '/admin/login', element: withSuspense(<Login />) },
  { path: '/admin/*', element: withSuspense(<AdminApp />) },
  { path: '*', element: <Site notFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
