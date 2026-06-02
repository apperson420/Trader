@app.route('/api/switch-strategy', methods=['POST'])
def switch_strategy():
    data = request.get_json() or {}
    strategy = data.get('strategy')
    
    if not strategy:
        return jsonify({'error': 'No strategy provided'}), 400
    
    # TODO: Wire this to actually update the active strategy in SovereignBot
    return jsonify({
        'status': 'success',
        'message': f'Strategy switch requested: {strategy}',
        'new_strategy': strategy
    })