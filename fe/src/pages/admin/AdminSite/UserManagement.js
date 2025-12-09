// UserManagement.js

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Search, Eye } from 'lucide-react';
import api from '../../../services/api';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All'); 
    const [roleFilter, setRoleFilter] = useState('All'); 
    const [sortBy, setSortBy] = useState('username'); 
    const [sortOrder, setSortOrder] = useState('asc'); 
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [viewingUser, setViewingUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState('');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        
        const params = {
            page,
            limit,
            search: searchTerm,
            sortBy,
            sortOrder,
        };

        if (statusFilter !== 'All') {
            params.status = statusFilter.toLowerCase(); 
        }
        if (roleFilter !== 'All') {
            params.role = roleFilter.toLowerCase(); 
        }

        try {
            const response = await api.get('/admin/users', { params }); 
            
            setUsers(response.data.data);
            setTotal(response.data.pagination.total);
            setTotalPages(response.data.pagination.totalPages);
        } catch (err) {
            setError(`Lỗi khi tải dữ liệu: ${err.message}`);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchTerm, statusFilter, roleFilter, sortBy, sortOrder]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);


    const toggleLock = async (userId, currentIsActive) => {
        const action = currentIsActive ? 'khóa' : 'mở khóa';
        if (window.confirm(`Bạn có chắc chắn muốn ${action} người dùng này?`)) {
            try {
                const response = await api.patch(`/admin/users/${userId}/lock`, {});                
                setUsers(users.map(user => 
                    user._id === userId 
                        ? { ...user, isActive: response.data.data.isActive }
                        : user
                ));
                alert(response.data.message);
            } catch (err) {
                alert(`Lỗi khi ${action}: ${err.message}`);
            }
        }
    };

    const handleViewDetail = (user) => {
        setViewingUser({ 
            ...user, 
            birthday: user.birthday ? new Date(user.birthday).toISOString().substring(0, 10) : ''
        });
        setShowModal(true);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    // Hàm xử lý sắp xếp (giữ nguyên logic từ phản hồi trước)
    const handleSort = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
        setPage(1); 
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            {/* Filters (Giữ nguyên) */}
            <div className="mb-6 flex gap-4 flex-wrap">
                <select 
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option>All</option>
                    <option>Active</option>
                    <option>Locked</option>
                </select>
                
                <select 
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                    className="px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option>All</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>

                <select 
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="px-4 py-2 bg-teal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ml-auto"
                >
                    <option value="username">Username</option>
                    <option value="email">Email</option>
                    <option value="createdAt">Created Date</option>
                </select>
                
                <select 
                    value={sortOrder}
                    onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
                    className="px-4 py-2 bg-teal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="asc">↑</option>
                    <option value="desc">↓</option>
                </select>
            </div>

            <div className="bg-gray-800 bg-opacity-40 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-6">User Management</h2>
                
                {/* Search (Giữ nguyên) */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by username, email or display name"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {error && <div className="p-4 mb-4 text-red-400 bg-red-900 rounded-lg">{error}</div>}

                {/* Table */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-10">Đang tải người dùng...</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-gray-700">
                                    {/* CỘT THỨ TỰ MỚI */}
                                    <th className="pb-4 px-4">Index</th> 
                              
                                    <th className="pb-4 px-4 cursor-pointer" onClick={() => handleSort('username')}>
                                        Username {sortBy === 'username' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="pb-4 px-4 cursor-pointer" onClick={() => handleSort('email')}>
                                        Email {sortBy === 'email' && (sortOrder === 'asc' ? '▲' : '▼')}
                                    </th>
                                    <th className="pb-4 px-4">Role</th>
                                    <th className="pb-4 px-4">Status (Active)</th>
                                    <th className="pb-4 px-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? users.map((user, index) => (
                                    <tr key={user._id} className="border-b border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition">
                                        
                                        {/* CỘT INDEX (Thứ tự 1, 2, 3...) */}
                                        <td className="py-4 px-4 text-sm font-semibold">
                                            {/* Tính thứ tự dựa trên page hiện tại */}
                                            {(page - 1) * limit + index + 1}
                                        </td>
                                        
                                                                              
                                        <td className="py-4 px-4">{user.username}</td>
                                        <td className="py-4 px-4">
                                            <a href={`mailto:${user.email}`} className="text-blue-400 hover:underline">
                                                {user.email}
                                            </a>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                                user.roleId === 'admin' 
                                                    ? 'bg-purple-600 text-white' 
                                                    : 'bg-blue-600 text-white'
                                            }`}>
                                                {user.roleId.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-4 py-1 rounded-full text-sm ${
                                                user.isActive 
                                                    ? 'bg-green-600 text-white' 
                                                    : 'bg-red-600 text-white'
                                            }`}>
                                                {user.isActive ? 'Active' : 'Locked'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewDetail(user)}
                                                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
                                                >
                                                    <Eye size={16} />
                                                    <span>Detail</span>
                                                </button>
                                                <button
                                                    onClick={() => toggleLock(user._id, user.isActive)}
                                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition ${
                                                        user.isActive
                                                            ? 'bg-red-600 hover:bg-red-700' 
                                                            : 'bg-green-600 hover:bg-green-700' 
                                                    }`}
                                                >
                                                    {user.isActive ? (
                                                        <>
                                                            <Lock size={16} />
                                                            <span>Lock</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Unlock size={16} />
                                                            <span>Unlock</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="py-10 text-center text-gray-400">
                                            Không tìm thấy người dùng nào.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Pagination (Giữ nguyên) */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6">
                        <p className="text-sm text-gray-400">
                            Hiển thị {(page - 1) * limit + 1} đến {Math.min(page * limit, total)} trên tổng số {total} người dùng
                        </p>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 bg-gray-700 rounded-lg">{page} / {totalPages}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                                className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal (Read-only) */}
            {showModal && viewingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold mb-6">User Details</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Username</label>
                                <input
                                    type="text"
                                    value={viewingUser.username || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Display Name</label>
                                <input
                                    type="text"
                                    value={viewingUser.displayName || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Email</label>
                                <input
                                    type="email"
                                    value={viewingUser.email || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Birthday</label>
                                <input
                                    type="date"
                                    value={viewingUser.birthday || ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Role</label>
                                <input
                                    type="text"
                                    value={viewingUser.roleId ? viewingUser.roleId.toUpperCase() : ''}
                                    disabled
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 text-gray-400">Status</label>
                                <div className="w-full px-4 py-2">
                                    <span className={`px-4 py-1 rounded-full text-sm font-semibold ${
                                        viewingUser.isActive 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-red-600 text-white'
                                    }`}>
                                        {viewingUser.isActive ? 'Active' : 'Locked'}
                                    </span>
                                </div>
                            </div>

                            {viewingUser.createdAt && (
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-400">Created At</label>
                                    <input
                                        type="text"
                                        value={new Date(viewingUser.createdAt).toLocaleString()}
                                        disabled
                                        className="w-full px-4 py-2 bg-gray-700 rounded-lg text-gray-300 cursor-not-allowed"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    setViewingUser(null);
                                }}
                                className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;