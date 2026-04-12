import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const TestPage = () => {
    const [status, setStatus] = useState('Checking...');
    const [adminViewPsych, setAdminViewPsych] = useState(null);
    const [adminViewOfficer, setAdminViewOfficer] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const { count, error } = await supabase
                .from('bulletins')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            setStatus(`Connected! Bulletin Count: ${count}`);
        } catch (err) {
            setStatus('Connection Failed: ' + err.message);
        }
    };

    const testAdminPsych = async () => {
        try {
            const { data, error } = await supabase.rpc('get_admin_view_psychologists');
            if (error) throw error;
            setAdminViewPsych(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            setAdminViewPsych(null);
        }
    };

    const testAdminOfficer = async () => {
        try {
            const { data, error } = await supabase.rpc('get_admin_view_officers');
            if (error) throw error;
            setAdminViewOfficer(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            setAdminViewOfficer(null);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">System Test Page</h1>

            <div className="bg-gray-100 p-4 rounded mb-6">
                <h2 className="font-bold">Supabase Status:</h2>
                <p className={status.includes('Failed') ? 'text-red-600' : 'text-green-600'}>
                    {status}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="border p-4 rounded bg-white shadow">
                    <h2 className="font-bold mb-2">Test Admin View (Psychologists)</h2>
                    <button
                        onClick={testAdminPsych}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Fetch Data (RPC)
                    </button>
                    {adminViewPsych && (
                        <div className="mt-4 text-xs font-mono bg-gray-50 p-2 overflow-auto max-h-40 border">
                            {JSON.stringify(adminViewPsych[0], null, 2)}
                            {adminViewPsych.length > 1 && ` ... and ${adminViewPsych.length - 1} more`}
                        </div>
                    )}
                </div>

                <div className="border p-4 rounded bg-white shadow">
                    <h2 className="font-bold mb-2">Test Admin View (Officers)</h2>
                    <button
                        onClick={testAdminOfficer}
                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    >
                        Fetch Data (RPC)
                    </button>
                    {adminViewOfficer && (
                        <div className="mt-4 text-xs font-mono bg-gray-50 p-2 overflow-auto max-h-40 border">
                            {JSON.stringify(adminViewOfficer[0], null, 2)}
                            {adminViewOfficer.length > 1 && ` ... and ${adminViewOfficer.length - 1} more`}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                    <strong>RPC Error:</strong> {error}
                </div>
            )}

            <div className="mt-8 text-sm text-gray-500">
                Note: RPC calls might fail if you are not logged in as a user with appropriate permissions (Role: anon/authenticated).
            </div>
        </div>
    );
};

export default TestPage;
