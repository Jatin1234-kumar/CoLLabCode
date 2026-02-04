import { useState, useEffect } from 'react';
import { getRoomVersions } from '../services/api.js';
import '../styles/components.css';

export default function VersionHistory({ roomId, socket }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersions();

    // Listen for new version saves
    if (socket) {
      socket.on('version:saved', (data) => {
        console.log('Version saved event received:', data);
        fetchVersions();
      });
    }

    return () => {
      if (socket) {
        socket.off('version:saved');
      }
    };
  }, [roomId, socket]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await getRoomVersions(roomId);
      console.log('Fetched versions:', response.data.data);
      setVersions(response.data.data || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = (versionId) => {
    console.log('Restoring version:', versionId);
    if (socket) {
      socket.emit(
        'version:restore',
        { roomId, versionId },
        (response) => {
          console.log('Restore response:', response);
          if (!response.success) {
            console.error('Failed to restore version:', response.message);
            alert(`Failed to restore: ${response.message}`);
          } else {
            console.log('Version restored successfully');
          }
        }
      );
    } else {
      console.error('Socket not available');
    }
  };

  const handleSaveVersion = () => {
    console.log('Saving version...');
    if (socket) {
      socket.emit('version:save', { roomId }, (response) => {
        console.log('Save response:', response);
        if (!response.success) {
          console.error('Failed to save version:', response.message);
          alert(`Failed to save: ${response.message}`);
        } else {
          console.log('Version saved successfully');
          fetchVersions();
        }
      });
    } else {
      console.error('Socket not available');
    }
  };

  const handleDeleteVersion = (versionId) => {
    if (!window.confirm('Are you sure you want to delete this version?')) {
      return;
    }
    
    console.log('Deleting version:', versionId);
    if (socket) {
      socket.emit(
        'version:delete',
        { roomId, versionId },
        (response) => {
          console.log('Delete response:', response);
          if (!response.success) {
            console.error('Failed to delete version:', response.message);
            alert(`Failed to delete: ${response.message}`);
          } else {
            console.log('Version deleted successfully');
            fetchVersions();
          }
        }
      );
    } else {
      console.error('Socket not available');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="version-history">
      <h3>📚 Version History</h3>
      <button onClick={handleSaveVersion} className="save-version-btn">
        💾 Save Current Version
      </button>

      {loading && <div className="loading">Loading versions...</div>}
      
      {!loading && versions.length === 0 && (
        <div className="empty-versions">
          <p>No versions saved yet</p>
          <small>Click "Save Current Version" to create one</small>
        </div>
      )}

      {!loading && versions.length > 0 && (
        <div className="version-list">
          {versions.map((version, index) => (
            <div key={version._id} className="version-item">
              <div className="version-info">
                <div className="version-label">
                  {version.label || `Version ${versions.length - index}`}
                </div>
                <small>{version.author?.displayName || 'Unknown'}</small>
                <small>{formatDate(version.createdAt)}</small>
              </div>
              <div className="version-actions">
                <button 
                  className="restore-btn" 
                  onClick={() => handleRestoreVersion(version._id)}
                >
                  ↩️ Restore
                </button>
                <button 
                  className="delete-btn" 
                  onClick={() => handleDeleteVersion(version._id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
