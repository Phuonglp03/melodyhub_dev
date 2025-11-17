import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLickById, updateLick } from '../../../services/user/lickService';

const EditLickPage = () => {
  const { lickId } = useParams();
  const navigate = useNavigate();
  const [lick, setLick] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLick = async () => {
      try {
        const response = await getLickById(lickId);
        if (response.success) {
          setLick(response.data);
          setFormData(response.data);
        } else {
          setError('Failed to fetch lick data');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLick();
  }, [lickId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateLick(lickId, formData);
      navigate('/library/my-licks');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-950 pt-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Edit Lick</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title || ''}
              onChange={handleInputChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
            />
          </div>
          <div className="flex space-x-4">
            <button type="submit" className="bg-orange-600 text-white px-6 py-2 rounded-md">
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate('/library/my-licks')}
              className="bg-gray-700 text-white px-6 py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLickPage;
